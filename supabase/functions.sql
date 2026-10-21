-- Run SECOND. All writes go through these checked functions.
create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'staff');
$$;

create function write_log(p_sub uuid, p_action text, p_details text) returns void
language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, submission_id, action, details) values (auth.uid(), p_sub, p_action, p_details);
$$;

create function assign_scholar(p_scholar uuid, p_student_id text, p_program int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Only staff can manage assignments'; end if;
  if coalesce(trim(p_student_id),'') = '' then raise exception 'Student ID is required'; end if;
  if exists (select 1 from profiles where student_id = p_student_id and id <> p_scholar) then
    raise exception 'Student ID % is already used by another scholar', p_student_id;
  end if;
  update profiles set student_id = p_student_id where id = p_scholar and role = 'scholar';
  if not found then raise exception 'Scholar account not found'; end if;
  insert into scholar_assignments (scholar_id, program_id) values (p_scholar, p_program)
    on conflict (scholar_id) do update set program_id = excluded.program_id;
end $$;

create function submit_semester(p_year text, p_sem text, p_gwa numeric, p_units int,
  p_failed int, p_inc int, p_drop int, p_ref text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_prog int; v_id uuid;
begin
  select program_id into v_prog from scholar_assignments where scholar_id = auth.uid();
  if v_prog is null then raise exception 'You have no scholarship assignment yet'; end if;
  begin
    insert into semester_submissions (scholar_id, program_id, academic_year, semester, gwa,
      enrolled_units, failed_count, incomplete_count, dropped_count, evidence_reference)
    values (auth.uid(), v_prog, p_year, p_sem, p_gwa, p_units, p_failed, p_inc, p_drop, p_ref)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A submission already exists for % semester %', p_year, p_sem;
  end;
  perform write_log(v_id, 'Submission created', 'GWA ' || p_gwa);
  return v_id;
end $$;

create function resubmit_semester(p_id uuid, p_gwa numeric, p_units int, p_failed int,
  p_inc int, p_drop int, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update semester_submissions set gwa = p_gwa, enrolled_units = p_units, failed_count = p_failed,
    incomplete_count = p_inc, dropped_count = p_drop, evidence_reference = p_ref,
    verification_status = 'Pending verification', compliance_status = 'Not evaluated',
    deficiency_reasons = null, evaluated_at = null, updated_at = now()
  where id = p_id and scholar_id = auth.uid() and verification_status = 'Returned';
  if not found then raise exception 'Only your returned submissions can be corrected'; end if;
  perform write_log(p_id, 'Corrected and resubmitted', 'Back to Pending verification');
end $$;

create function verify_submission(p_id uuid, p_ok boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Only staff can verify evidence'; end if;
  if not p_ok and coalesce(trim(p_reason),'') = '' then raise exception 'A reason is required to return evidence'; end if;
  update semester_submissions set
    verification_status = case when p_ok then 'Verified' else 'Returned' end,
    verification_reason = p_reason, updated_at = now()
  where id = p_id and verification_status = 'Pending verification';
  if not found then raise exception 'Submission is not pending verification'; end if;
  perform write_log(p_id, case when p_ok then 'Evidence verified' else 'Evidence returned' end, p_reason);
end $$;

-- Thresholds come from scholarship_programs, never hardcoded.
create function evaluate_compliance(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s semester_submissions; p scholarship_programs; checks jsonb; bad int;
begin
  if not is_staff() then raise exception 'Only staff can evaluate compliance'; end if;
  select * into s from semester_submissions where id = p_id;
  if not found then raise exception 'Submission not found'; end if;
  if s.verification_status <> 'Verified' then raise exception 'Evidence must be verified before evaluation'; end if;
  select * into p from scholarship_programs where id = s.program_id;
  checks := jsonb_build_array(
    jsonb_build_object('check','GWA','ok', s.gwa <= p.max_gwa, 'detail', s.gwa || ' (max ' || p.max_gwa || ')'),
    jsonb_build_object('check','Enrolled units','ok', s.enrolled_units >= p.min_units, 'detail', s.enrolled_units || ' (min ' || p.min_units || ')'),
    jsonb_build_object('check','Failed subjects','ok', s.failed_count <= p.max_failed, 'detail', s.failed_count || ' (max ' || p.max_failed || ')'),
    jsonb_build_object('check','Incomplete grades','ok', s.incomplete_count <= p.max_incomplete, 'detail', s.incomplete_count || ' (max ' || p.max_incomplete || ')'),
    jsonb_build_object('check','Dropped subjects','ok', s.dropped_count <= p.max_dropped, 'detail', s.dropped_count || ' (max ' || p.max_dropped || ')'),
    jsonb_build_object('check','Evidence reference','ok', length(trim(s.evidence_reference)) > 0, 'detail', s.evidence_reference),
    jsonb_build_object('check','Submission deadline','ok', s.submitted_at <= p.deadline,
      'detail', 'Received ' || to_char(s.submitted_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI:SS') ||
                ' PHT; deadline ' || to_char(p.deadline at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI:SS') || ' PHT'));
  select count(*) into bad from jsonb_array_elements(checks) c where (c->>'ok')::boolean = false;
  update semester_submissions set deficiency_reasons = checks, evaluated_at = now(), updated_at = now(),
    compliance_status = case when bad = 0 then 'Compliant' else 'With Deficiency' end where id = p_id;
  perform write_log(p_id, 'Compliance evaluated', case when bad = 0 then 'Compliant' else 'With Deficiency (' || bad || ' failed checks)' end);
  return checks;
end $$;

create function record_decision(p_id uuid, p_decision text, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
declare s semester_submissions;
begin
  if not is_staff() then raise exception 'Only staff can record renewal decisions'; end if;
  if coalesce(trim(p_notes),'') = '' then raise exception 'Decision notes are required'; end if;
  select * into s from semester_submissions where id = p_id;
  if not found then raise exception 'Submission not found'; end if;
  if s.verification_status <> 'Verified' then raise exception 'Evidence must be verified first'; end if;
  if s.compliance_status = 'Not evaluated' then raise exception 'Evaluate compliance first'; end if;
  if p_decision = 'Approved' and s.compliance_status <> 'Compliant' then
    raise exception 'Deficient submissions cannot be approved; place them on hold instead'; end if;
  insert into renewal_decisions (submission_id, decision, decision_notes, decided_by)
    values (p_id, p_decision, p_notes, auth.uid());
  perform write_log(p_id, 'Renewal ' || p_decision, p_notes);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function assign_scholar(uuid,text,int), submit_semester(text,text,numeric,int,int,int,int,text),
  resubmit_semester(uuid,numeric,int,int,int,int,text), verify_submission(uuid,boolean,text),
  evaluate_compliance(uuid), record_decision(uuid,text,text), is_staff() to authenticated;

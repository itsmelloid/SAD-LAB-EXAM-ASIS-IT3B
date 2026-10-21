-- Run THIRD. RLS: users may only READ; every write goes through functions.sql.
alter table profiles enable row level security;
alter table scholarship_programs enable row level security;
alter table scholar_assignments enable row level security;
alter table semester_submissions enable row level security;
alter table renewal_decisions enable row level security;
alter table audit_logs enable row level security;

revoke insert, update, delete, truncate on profiles, scholarship_programs, scholar_assignments,
  semester_submissions, renewal_decisions, audit_logs from anon, authenticated;
revoke select on profiles, scholarship_programs, scholar_assignments,
  semester_submissions, renewal_decisions, audit_logs from anon;

create policy "own or staff" on profiles for select to authenticated using (id = auth.uid() or is_staff());
create policy "programs readable" on scholarship_programs for select to authenticated using (true);
create policy "own or staff" on scholar_assignments for select to authenticated using (scholar_id = auth.uid() or is_staff());
create policy "own or staff" on semester_submissions for select to authenticated using (scholar_id = auth.uid() or is_staff());
create policy "own or staff" on renewal_decisions for select to authenticated using (
  is_staff() or exists (select 1 from semester_submissions s where s.id = submission_id and s.scholar_id = auth.uid()));
create policy "own or staff" on audit_logs for select to authenticated using (
  is_staff() or exists (select 1 from semester_submissions s where s.id = submission_id and s.scholar_id = auth.uid()));
-- No insert/update/delete policies exist: direct writes, and edits to audit history, are rejected.

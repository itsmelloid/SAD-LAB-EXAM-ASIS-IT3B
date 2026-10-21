-- Run FOURTH. Fictional data only. Seeded scholars have no password (they cannot log in);
-- staff verify/evaluate/decide on them.
insert into scholarship_programs (name,max_gwa,min_units,max_failed,max_incomplete,max_dropped,deadline) values
 ('Excellence Scholar',2.00,18,0,0,0,'2026-11-06 17:00:00+08'),
 ('Access Scholar',2.50,15,0,0,1,'2026-11-06 17:00:00+08');

do $$
declare rec record; uid uuid; pid int;
begin
  for rec in select * from (values
    ('B01','Ana Reyes (test)','Excellence Scholar',2.00,18,0,0,0,'2026-11-06 17:00:00+08'::timestamptz,'Verified'),
    ('B02','Ben Cruz (test)','Excellence Scholar',2.01,18,0,0,0,'2026-11-05 10:00:00+08'::timestamptz,'Verified'),
    ('B03','Carla Dizon (test)','Access Scholar',2.50,15,0,0,1,'2026-11-05 10:00:00+08'::timestamptz,'Verified'),
    ('B04','Dan Lim (test)','Access Scholar',2.50,14,0,1,0,'2026-11-05 10:00:00+08'::timestamptz,'Verified'),
    ('B05','Ella Tan (test)','Excellence Scholar',1.75,18,1,0,0,'2026-11-06 17:01:00+08'::timestamptz,'Verified'),
    ('B06','Fe Ramos (test)','Access Scholar',2.25,15,0,0,0,'2026-11-05 10:00:00+08'::timestamptz,'Pending verification')
  ) as t(sid,nm,prog,gwa,units,f,i,d,at,vs)
  loop
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      values (uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',lower(rec.sid)||'@test.invalid',now(),now());
    update profiles set full_name = rec.nm, student_id = '2026-'||rec.sid where id = uid;
    select id into pid from scholarship_programs where name = rec.prog;
    insert into scholar_assignments (scholar_id, program_id) values (uid, pid);
    insert into semester_submissions (scholar_id, program_id, academic_year, semester, gwa, enrolled_units,
      failed_count, incomplete_count, dropped_count, evidence_reference, submitted_at, verification_status)
    values (uid, pid, '2026-2027','1', rec.gwa, rec.units, rec.f, rec.i, rec.d, 'TEST-DOC-'||rec.sid, rec.at, rec.vs);
  end loop;
end $$;

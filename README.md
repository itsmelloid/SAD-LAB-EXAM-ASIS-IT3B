# Student Scholarship Monitoring and Academic Compliance System

## 1. Overview
A browser-based system for two scholarship programs (Excellence Scholar and Access Scholar).
- **Scholars** submit semester grade summaries, track verification status and staff feedback, and correct returned submissions.
- **Scholarship staff** register and assign scholars, verify or return evidence, evaluate compliance, and record renewal decisions (Approved or Held).
- Every action is saved in an append-only audit history.

The system never changes official grades, releases payments, or disqualifies anyone automatically.

**Technology:** HTML5, CSS3, Vanilla JavaScript; Supabase (PostgreSQL, Supabase Auth, Row Level Security); Git/GitHub. No frameworks.

## 2. Folder contents
| Folder | Contents |
|---|---|
| `1_Analysis_Report/` | `Analysis_Report.docx` (A1 to A6, use case diagram, two use cases, ERD, traceability matrix) and diagram images |
| `2_Source_Code/` | `login.html`, `scholar-dashboard.html`, `staff-dashboard.html`, `css/`, `js/`, `supabase/` (`schema.sql`, `functions.sql`, `policies.sql`, `seed.sql`) |
| `3_Test_Results_and_Evidence/` | `TC01-TC10_Test_Results.md` and `screenshots/` |

## 3. Prerequisites
- A free Supabase account (supabase.com)
- A modern browser (Chrome, Edge, Firefox)
- Python 3 (only to serve the files locally; any static file server works)
- Git and a GitHub account (only for publishing)

## 4. Environment variable names
This is a static website with no server, so there is **no `.env` file**. The configuration lives in two constants in `2_Source_Code/js/supabase-config.js`:

| Name | Value | Safe to publish? |
|---|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://abcdxyz.supabase.co` | Yes |
| `SUPABASE_KEY` | The **publishable (anon)** key | Yes, because Row Level Security protects the data |

The **service-role (secret) key** and the **database password** are never used by this project and must never be placed in any file, in GitHub, or in a screenshot. The submitted copy of `supabase-config.js` contains placeholders only.

## 5. Setup steps
### 5.1 Create the Supabase project
1. Sign in to Supabase and click **New project**.
2. Name it (for example `scholarship-monitoring`), set a database password (store it in a password manager), pick the nearest region, and click **Create new project**. Wait until the dashboard loads.

### 5.2 Run the SQL scripts, in this order
In **SQL Editor**, open a new query for each file, paste the whole file, click **Run**, and confirm "Success" before the next one.
1. `supabase/schema.sql` creates the six tables, constraints, indexes, and the trigger that makes a profile for each new user.
2. `supabase/functions.sql` creates the checked functions (`submit_semester`, `resubmit_semester`, `verify_submission`, `evaluate_compliance`, `record_decision`, `assign_scholar`).
3. `supabase/policies.sql` enables Row Level Security and the read-only policies.
4. `supabase/seed.sql` inserts the two program records and six fictional scholars (B01 to B06).

Check in **Table Editor**: `scholarship_programs` has 2 rows and `semester_submissions` has 6 rows. Run each script once; running twice gives "already exists" errors.

### 5.3 Configure the website
1. In **Project Settings, API**, copy the Project URL and the publishable (anon) key.
2. Paste them into `SUPABASE_URL` and `SUPABASE_KEY` in `js/supabase-config.js`.

### 5.4 Create the two test accounts (choose your own passwords; never write them in this repository)
1. **Authentication, Users, Add user, Create new user.** Create one staff and one scholar account, with **Auto Confirm User** ticked.
2. Make the staff account staff. This is the only way to get the role, so nobody can promote themselves from the website. In the SQL Editor:
   ```sql
   update profiles set role = 'staff', full_name = 'Test Staff' where id = '<STAFF-USER-UUID>';
   update profiles set full_name = 'Test Scholar' where id = '<SCHOLAR-USER-UUID>';
   ```
3. Log in as staff, open **Scholar management**, pick the test scholar, enter a student ID (for example `2026-T01`), choose a program, and click **Save assignment**.

## 6. Run the website locally
```
cd 2_Source_Code
python3 -m http.server 8000      # on Windows: python -m http.server 8000
```
Open http://localhost:8000/login.html. Use a local server rather than double-clicking the files, because login sessions can fail on `file://` pages.

## 7. How to use it
- **Scholar:** log in, fill in the grade form, submit, and view status. If staff return a submission, open **View**, correct the values, and click **Resubmit**; it goes back to Pending verification.
- **Staff:** log in, use search and filters, click **View** on a submission, then **Mark verified** or **Return for correction** (reason required), **Evaluate compliance** (only after verification), and **Approve renewal** or **Hold renewal** (notes required). Approval is refused for deficient submissions.

## 8. Testing
Open `3_Test_Results_and_Evidence/TC01-TC10_Test_Results.md`. Staff-side tests (TC01 to TC06, TC10) use the seeded B01 to B06 records. Scholar-side tests (TC07 to TC09) use your scholar account; role-isolation checks (TC08, TC10) are run from the browser console with direct calls such as `await db.rpc("verify_submission", {...})`, which the database must reject. Record only results you actually observed, and save screenshots (without keys or passwords) in `screenshots/`. Tests not yet run stay marked "not run".

## 9. Security design
- Row Level Security is on for every table. Browser clients can only read: scholars see only their own rows, staff see all.
- All writes go through `SECURITY DEFINER` functions that check the caller's role, so manually edited JavaScript or direct API calls are rejected.
- `audit_logs` has no insert, update or delete policy for users, so history cannot be altered or overwritten.
- Policy thresholds are read from `scholarship_programs`; none are hardcoded in JavaScript.
- Hiding buttons is not relied on for security.

## 10. Test-account access
Test-account emails and passwords are **supplied privately to the instructor** (not stored in this folder, the report, the repository, or any screenshot). Seeded B01 to B06 scholars have no passwords and cannot log in; they exist for staff to review.

## 11. Known defects and limitations
- Reasons and decision notes are entered through plain browser prompts, not a styled form.
- A resubmission keeps the original submission time, so a correction does not make an on-time submission late.
- Each scholar can have only one program assignment; staff cannot remove an assignment, only change it.
- There is no password reset, email confirmation flow, or pagination (the table is built for a small number of records).
- `seed.sql` inserts rows directly into `auth.users`; if Supabase changes the required columns, the seed may fail (create six users manually and link them as a fallback).
- The deadline is fixed in the seeded program records; changing it requires editing `scholarship_programs`.
- Performance (3 s for 500 submissions) and 360 px layout targets in the report have not been formally measured.
- All of TC01 to TC10 must be run by the student; unrun tests are marked "not run", and none is claimed as passed here.

## 12. Troubleshooting
| Problem | Fix |
|---|---|
| Nothing loads, "Invalid API key" | Check the URL and publishable key in `supabase-config.js` (no extra spaces) |
| `supabase is not defined` in the console | The Supabase script from the CDN did not load; check your internet connection |
| "Email not confirmed" | Recreate the user with Auto Confirm ticked, or confirm it in the Users list |
| Staff login opens the scholar dashboard | The staff role update in 5.4 did not run; rerun it with the correct UUID |
| Scholar sees "no scholarship assignment" | Staff must assign the scholar first (5.4, step 3) |
| Staff table is empty | `seed.sql` did not run, or you are logged in as a scholar |
| "already exists" when running SQL | Script was run twice; delete the tables and rerun from `schema.sql` |

## 13. GitHub repository setup
```
cd 2_Source_Code
git init
git add .
git commit -m "Scholarship monitoring system"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```
Before pushing, confirm `supabase-config.js` contains only the publishable key and no secrets.

## 14. Deployment (optional)
Host `2_Source_Code` on any static host. For GitHub Pages: repository **Settings, Pages**, branch `main`, folder `/ (root)`. Then add the hosted URL under **Authentication, URL Configuration** in Supabase.
Hosted URL: ______________________ (leave blank if not hosted)

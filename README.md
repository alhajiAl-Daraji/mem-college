# MEM College — starter project

This starter is designed for a free first deployment using GitHub + Vercel + Supabase.

## Files
- `index.html`: Arabic responsive UI.
- `app.js`: frontend logic and Supabase integration.
- `supabase-schema.sql`: database tables, RLS policies, private PDF bucket, teacher approval function.

## Important security notes
- The browser must contain only the Supabase project URL and the publishable/anon key. Never put the `service_role` or secret key in `app.js`.
- Teacher accounts are created as unapproved. The admin must approve them.
- The first admin must be promoted manually in Supabase SQL Editor using the final commented SQL statement in `supabase-schema.sql`.
- This is a first functional scaffold, not a fully audited production system. Test with separate student, teacher, and admin accounts before sharing widely.
- Email confirmation may be enabled by default in Supabase. Confirm the account email before signing in.
- Supabase Auth should have appropriate site URL and redirect URLs set after deployment.

## Setup sequence
1. Create a Supabase project.
2. Open SQL Editor and run the full `supabase-schema.sql`.
3. Register your own account through the app once Supabase settings are filled in, and confirm your email.
4. In SQL Editor, uncomment and edit the final `UPDATE` statement in `supabase-schema.sql` to promote your own email to admin. Run that statement only after replacing `YOUR_EMAIL`.
5. Copy the Supabase Project URL and publishable/anon key from Project Settings > API into `app.js`.
6. Create a GitHub repository and upload these three files to the repository root.
7. In Vercel, import that repository and deploy. Framework preset: Other; build command: leave blank; output directory: `.`.
8. In Supabase Auth URL Configuration, set Site URL to your Vercel URL and add that URL to Redirect URLs.
9. Test sign-up, sign-in, teacher approval, PDF upload, student access, and reports.

## Known first-version limitations
- The current student screen displays PDFs and report submission; teacher notes are stored, but the student notes display and report-status editing are not yet implemented.
- Content moderation, password reset UI, email delivery settings, rate limiting, backups, and a full admin management panel should be added before a large public launch.
- The admin approval function relies on the profile role being protected by RLS. Do not give the anon key extra privileges.
Deployment test

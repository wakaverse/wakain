-- Fix contact_inquiries RLS: use direct admin user_id instead of app.admin_ids setting
DROP POLICY IF EXISTS "Admin can read contact inquiries" ON contact_inquiries;
DROP POLICY IF EXISTS "Admin can update contact inquiries" ON contact_inquiries;

CREATE POLICY "Admin can read contact inquiries"
  ON contact_inquiries FOR SELECT
  TO authenticated
  USING (auth.uid() = 'f078b89f-4ab3-40af-8829-154e354fa351'::uuid);

CREATE POLICY "Admin can update contact inquiries"
  ON contact_inquiries FOR UPDATE
  TO authenticated
  USING (auth.uid() = 'f078b89f-4ab3-40af-8829-154e354fa351'::uuid);

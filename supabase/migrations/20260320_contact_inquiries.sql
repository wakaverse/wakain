-- contact_inquiries: store contact form submissions
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_type text NOT NULL,            -- pro / enterprise / api / partnership / other
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  job_title text,
  phone text,
  message text NOT NULL,
  source text DEFAULT 'nav',              -- landing_enterprise / landing_api / nav / etc
  status text NOT NULL DEFAULT 'new',     -- new / contacted / converted / closed
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (including anonymous / non-logged-in users)
CREATE POLICY "Anyone can insert contact inquiries"
  ON contact_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admin can read
CREATE POLICY "Admin can read contact inquiries"
  ON contact_inquiries FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT unnest(string_to_array(current_setting('app.admin_ids', true), ','))::uuid));

-- Only admin can update status
CREATE POLICY "Admin can update contact inquiries"
  ON contact_inquiries FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (SELECT unnest(string_to_array(current_setting('app.admin_ids', true), ','))::uuid));

-- Index for admin queries
CREATE INDEX idx_contact_inquiries_status ON contact_inquiries (status, created_at DESC);

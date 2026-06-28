// Shared constants for the CIP workspace.
// The standards catalog itself lives in Supabase (public.cip_standards) and is
// fetched at runtime for authenticated users — it is intentionally NOT bundled
// into the frontend.

export const CIP_STATUS = {
  MANDATORY: 'Currently Mandatory',
  NEAR_TERM: 'Effective Within 12 Months',
  FUTURE: 'Subject to Future Enforcement',
}

export const NERC_REGIONS = ['MRO', 'NPCC', 'RF', 'SERC', 'Texas RE', 'WECC']

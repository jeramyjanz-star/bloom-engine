export interface ChecklistItemTemplate {
  key: string
  label: string
  description: string
  category: 'gmb' | 'website' | 'social' | 'reviews' | 'aeo'
}

export const LAUNCH_CHECKLIST_ITEMS: ChecklistItemTemplate[] = [
  {
    key: 'gmb_profile_created',
    label: 'GMB Profile Created',
    description: 'Google Business Profile created at business.google.com/create',
    category: 'gmb',
  },
  {
    key: 'gmb_verified',
    label: 'GMB Verified',
    description: 'Profile verified via postcard, phone, or video call',
    category: 'gmb',
  },
  {
    key: 'schema_installed',
    label: 'Schema Bundle Installed',
    description: 'JSON-LD schema bundle installed on frenchbloomsoc.com',
    category: 'website',
  },
  {
    key: 'blog_first_post',
    label: 'First Blog Post Published',
    description: 'First SEO blog post live on website',
    category: 'website',
  },
  {
    key: 'gmb_photos_20',
    label: '20 GMB Photos Uploaded',
    description: '20+ photos uploaded to Google Business Profile',
    category: 'gmb',
  },
  {
    key: 'gmb_first_post',
    label: 'First GMB Post Published',
    description: 'First Google Business post published',
    category: 'gmb',
  },
  {
    key: 'instagram_bio',
    label: 'Instagram Bio Updated',
    description: 'Instagram bio updated with website link',
    category: 'social',
  },
  {
    key: 'pinterest_account',
    label: 'Pinterest Business Account',
    description: 'Pinterest business account created',
    category: 'social',
  },
  {
    key: 'pinterest_first_board',
    label: 'First Pinterest Board Created',
    description: 'Wedding Florals OC board created with first pins',
    category: 'social',
  },
  {
    key: 'review_system_active',
    label: 'Review System Active',
    description: 'Review request system configured & tested',
    category: 'reviews',
  },
  {
    key: 'google_reviews_5',
    label: 'First 5 Google Reviews',
    description: 'First 5 Google reviews received and responded to',
    category: 'reviews',
  },
  {
    key: 'aeo_queries_tested',
    label: 'All AEO Queries Tested',
    description: 'All 10 Perplexity AEO queries tested in BLOOM ENGINE',
    category: 'aeo',
  },
]

export const CATEGORY_LABELS: Record<ChecklistItemTemplate['category'], string> = {
  gmb: 'Google Business',
  website: 'Website',
  social: 'Social Media',
  reviews: 'Reviews',
  aeo: 'AEO Intelligence',
}

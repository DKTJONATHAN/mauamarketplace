import { supabase } from './supabase';

export type AdPlacement = 'homepage_banner' | 'category_feature' | 'business_spotlight';
export type AdDuration = 7 | 30;

export const adPackages: Record<AdPlacement, {
  name: string;
  description: string;
  weeklyPrice: number;
  monthlyPrice: number;
  placementLabel: string;
}> = {
  homepage_banner: {
    name: 'Homepage banner',
    description: 'A prominent, clearly labelled advertising position on the Maua Marketplace homepage.',
    weeklyPrice: 500,
    monthlyPrice: 1500,
    placementLabel: 'Homepage',
  },
  category_feature: {
    name: 'Category feature',
    description: 'A sponsored position for customers browsing a relevant product or service category.',
    weeklyPrice: 300,
    monthlyPrice: 900,
    placementLabel: 'Category pages',
  },
  business_spotlight: {
    name: 'Business spotlight',
    description: 'A compact business promotion in selected marketplace discovery areas.',
    weeklyPrice: 250,
    monthlyPrice: 700,
    placementLabel: 'Discovery areas',
  },
};

export interface AdvertisingRequestInput {
  businessName: string;
  contactPhone: string;
  websiteUrl: string;
  placement: AdPlacement;
  durationDays: AdDuration;
  startDate: string;
  creativeUrl: string;
  notes: string;
}

export async function submitAdvertisingRequest(input: AdvertisingRequestInput): Promise<void> {
  const pkg = adPackages[input.placement];
  const amount = input.durationDays === 7 ? pkg.weeklyPrice : pkg.monthlyPrice;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Please sign in to request an advertising slot.');

  const { error } = await supabase.from('advertising_requests').insert({
    user_id: user.id,
    business_name: input.businessName.trim(),
    contact_phone: input.contactPhone.trim(),
    website_url: input.websiteUrl.trim() || null,
    placement: input.placement,
    duration_days: input.durationDays,
    amount_kes: amount,
    start_date: input.startDate,
    creative_url: input.creativeUrl.trim() || null,
    notes: input.notes.trim() || null,
  });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('Advertising bookings are not enabled yet. Please try again later.');
    }
    throw new Error(error.message || 'Your advertising request could not be submitted.');
  }
}

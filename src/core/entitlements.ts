import type { LicensePlan, LicenseSnapshot } from './license';

export type Plan = LicensePlan;

export type Feature =
  | 'description.basic'
  | 'description.advanced'
  | 'titles.advanced'
  | 'analytics.csv'
  | 'export'
  | 'watchlist'
  | 'audit.full'
  | 'keywords';

const PLAN_FEATURES: Record<Plan, readonly Feature[]> = {
  free: ['description.basic', 'audit.full', 'keywords'],
  pro: [
    'description.basic',
    'description.advanced',
    'titles.advanced',
    'analytics.csv',
    'export',
    'watchlist',
    'audit.full',
    'keywords',
  ],
};

export function featuresForPlan(plan: Plan): readonly Feature[] {
  return PLAN_FEATURES[plan];
}

export function can(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export function canFromSnapshot(
  snapshot: LicenseSnapshot | null | undefined,
  feature: Feature,
): boolean {
  return can(snapshot?.plan ?? 'free', feature);
}

export function entitlementsFromSnapshot(
  snapshot: LicenseSnapshot | null | undefined,
): { plan: Plan; isPro: boolean; features: readonly Feature[] } {
  const plan = snapshot?.plan ?? 'free';
  return {
    plan,
    isPro: snapshot?.isPro === true,
    features: featuresForPlan(plan),
  };
}

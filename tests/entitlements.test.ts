import { describe, expect, it } from 'vitest';
import {
  can,
  canFromSnapshot,
  entitlementsFromSnapshot,
  featuresForPlan,
} from '../src/core/entitlements';
import type { LicenseSnapshot } from '../src/core/license';

function snapshot(overrides: Partial<LicenseSnapshot> = {}): LicenseSnapshot {
  return {
    plan: 'free',
    status: 'free',
    isPro: false,
    keyMasked: '',
    instanceId: null,
    variantId: null,
    variantName: null,
    activationLimit: null,
    activationUsage: null,
    expiresAt: null,
    lastValidatedAt: null,
    offlineGraceUntil: null,
    error: null,
    canActivate: false,
    canDeactivate: false,
    ...overrides,
  };
}

describe('entitlements', () => {
  it('keeps the basic optimizer and full audit free', () => {
    expect(can('free', 'description.basic')).toBe(true);
    expect(can('free', 'audit.full')).toBe(true);
    expect(can('free', 'keywords')).toBe(true);
  });

  it('locks the advanced optimizer, advanced titles and analytics', () => {
    expect(can('free', 'description.advanced')).toBe(false);
    expect(can('free', 'titles.advanced')).toBe(false);
    expect(can('free', 'analytics.csv')).toBe(false);
    expect(can('free', 'export')).toBe(false);
    expect(can('free', 'watchlist')).toBe(false);
  });

  it('unlocks every feature for Pro', () => {
    for (const feature of featuresForPlan('pro')) {
      expect(can('pro', feature)).toBe(true);
    }
    expect(can('pro', 'description.advanced')).toBe(true);
    expect(can('pro', 'analytics.csv')).toBe(true);
  });

  it('reads the plan from a snapshot', () => {
    expect(canFromSnapshot(null, 'description.advanced')).toBe(false);
    expect(canFromSnapshot(snapshot(), 'description.advanced')).toBe(false);
    expect(
      canFromSnapshot(snapshot({ plan: 'pro', isPro: true }), 'description.advanced'),
    ).toBe(true);
  });

  it('returns the feature list for the current plan', () => {
    const free = entitlementsFromSnapshot(snapshot());
    expect(free.plan).toBe('free');
    expect(free.isPro).toBe(false);
    expect(free.features).toContain('description.basic');
    expect(free.features).not.toContain('description.advanced');

    const pro = entitlementsFromSnapshot(snapshot({ plan: 'pro', isPro: true }));
    expect(pro.plan).toBe('pro');
    expect(pro.isPro).toBe(true);
    expect(pro.features).toContain('description.advanced');
  });
});

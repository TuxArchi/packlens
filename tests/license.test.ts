import { describe, expect, it, vi } from 'vitest';
import {
  activate,
  clearLicense,
  deactivate,
  deriveLicenseSnapshot,
  emptyLicense,
  getLicenseSnapshot,
  LICENSE_STORAGE_KEY,
  loadLicense,
  maskLicenseKey,
  OFFLINE_GRACE_MS,
  planForMeta,
  saveLicense,
  validateCurrent,
  validateIfDue,
} from '../src/core/license';
import type {
  LicenseStorage,
  StoredLicense,
} from '../src/core/license';

const NOW = Date.parse('2026-11-01T12:00:00.000Z');

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function memoryStorage(
  initial: Record<string, unknown> = {},
): LicenseStorage & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    },
    remove: async (key: string) => {
      delete data[key];
    },
  };
}

function stored(overrides: Partial<StoredLicense> = {}): StoredLicense {
  return {
    ...emptyLicense(),
    key: 'B1E8-TEST-0000-0000-0921',
    plan: 'pro',
    status: 'active',
    instanceId: 'instance-1',
    instanceName: 'packlens-test',
    variantId: 2323794,
    variantName: 'PackLens PRO',
    activationLimit: 3,
    activationUsage: 1,
    lastValidatedAt: new Date(NOW - 60_000).toISOString(),
    validUntil: new Date(NOW + OFFLINE_GRACE_MS).toISOString(),
    ...overrides,
  };
}

const activationResponse = {
  activated: true,
  license_key: {
    status: 'active',
    activation_limit: 3,
    activation_usage: 1,
    expires_at: null,
  },
  instance: { id: 'instance-1', name: 'packlens-test' },
  meta: {
    product_id: 1491549,
    variant_id: 2323794,
    variant_name: 'PackLens PRO',
  },
};

const validationResponse = {
  valid: true,
  license_key: {
    status: 'active',
    activation_limit: 3,
    activation_usage: 1,
    expires_at: null,
  },
  instance: { id: 'instance-1' },
  meta: {
    product_id: 1491549,
    variant_id: 2323794,
    variant_name: 'PackLens PRO',
  },
};

describe('maskLicenseKey', () => {
  it('shows only the first and last four characters', () => {
    expect(maskLicenseKey('B1E8-TEST-0000-0000-0921')).toBe(
      'B1E8…0921',
    );
  });

  it('hides short keys completely', () => {
    expect(maskLicenseKey('ABC123')).toBe('••••••••');
    expect(maskLicenseKey('')).toBe('');
  });
});

describe('planForMeta', () => {
  it('maps both known variants to Pro', () => {
    expect(planForMeta({ product_id: 1491549, variant_id: 2323794 })).toBe('pro');
    expect(planForMeta({ product_id: 1491549, variant_id: 2323795 })).toBe('pro');
  });

  it('rejects another product or unknown variant', () => {
    expect(planForMeta({ product_id: 111, variant_id: 2323794 })).toBe('free');
    expect(planForMeta({ product_id: 1491549, variant_id: 999 })).toBe('free');
  });

  it('assumes Pro when meta is missing', () => {
    expect(planForMeta(null)).toBe('pro');
  });
});

describe('deriveLicenseSnapshot', () => {
  it('returns Free without a key', () => {
    const snapshot = deriveLicenseSnapshot(emptyLicense(), NOW);
    expect(snapshot.plan).toBe('free');
    expect(snapshot.status).toBe('free');
    expect(snapshot.isPro).toBe(false);
    expect(snapshot.canActivate).toBe(false);
  });

  it('marks an inactive key as activatable', () => {
    const snapshot = deriveLicenseSnapshot(
      stored({ plan: 'free', status: 'inactive', instanceId: null, validUntil: null }),
      NOW,
    );
    expect(snapshot.status).toBe('inactive');
    expect(snapshot.isPro).toBe(false);
    expect(snapshot.canActivate).toBe(true);
  });

  it('keeps Pro active inside the offline grace', () => {
    const snapshot = deriveLicenseSnapshot(stored(), NOW);
    expect(snapshot.plan).toBe('pro');
    expect(snapshot.status).toBe('active');
    expect(snapshot.isPro).toBe(true);
  });

  it('expires Pro after the offline grace', () => {
    const snapshot = deriveLicenseSnapshot(
      stored({ validUntil: new Date(NOW - 1).toISOString() }),
      NOW,
    );
    expect(snapshot.status).toBe('expired');
    expect(snapshot.isPro).toBe(false);
  });

  it('treats an active status without a device as inactive', () => {
    const snapshot = deriveLicenseSnapshot(
      stored({ plan: 'free', status: 'active', instanceId: null }),
      NOW,
    );
    expect(snapshot.status).toBe('inactive');
    expect(snapshot.isPro).toBe(false);
  });
});

describe('license storage', () => {
  it('saves, loads and clears the state locally', async () => {
    const storage = memoryStorage();
    await saveLicense(stored(), storage);
    expect(storage.data[LICENSE_STORAGE_KEY]).toMatchObject({
      key: 'B1E8-TEST-0000-0000-0921',
      plan: 'pro',
    });

    const loaded = await loadLicense(storage);
    expect(loaded.instanceId).toBe('instance-1');

    await clearLicense(storage);
    expect(await loadLicense(storage)).toEqual(emptyLicense());
  });
});

describe('activate', () => {
  it('stores the key and instance after a successful activation', async () => {
    const storage = memoryStorage();
    const mock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(activationResponse),
    );
    const result = await activate('  B1E8-TEST-0000-0000-0921  ', {
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
      instanceName: 'device-test',
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.isPro).toBe(true);
    expect(result.snapshot?.activationLimit).toBe(3);

    const storedState = storage.data[LICENSE_STORAGE_KEY] as StoredLicense;
    expect(storedState.key).toBe('B1E8-TEST-0000-0000-0921');
    expect(storedState.instanceId).toBe('instance-1');
    expect(storedState.lastValidatedAt).toBe(new Date(NOW).toISOString());

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain('/v1/licenses/activate');
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('license_key')).toBe('B1E8-TEST-0000-0000-0921');
    expect(body.get('instance_name')).toBe('device-test');
  });

  it('does not store anything when the activation limit is reached', async () => {
    const storage = memoryStorage();
    const mock = vi.fn(async () =>
      jsonResponse({ activated: false, error: 'activation_limit_reached' }),
    );
    const result = await activate('KEY', {
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('activation_limit_reached');
    expect(storage.data[LICENSE_STORAGE_KEY]).toBeUndefined();
  });

  it('rejects a license from another product', async () => {
    const storage = memoryStorage();
    const mock = vi.fn(async () =>
      jsonResponse({
        ...activationResponse,
        meta: { product_id: 999, variant_id: 1 },
      }),
    );
    const result = await activate('KEY', {
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('activation-failed');
    expect(storage.data[LICENSE_STORAGE_KEY]).toBeUndefined();
  });

  it('returns empty-key without calling the API', async () => {
    const mock = vi.fn();
    const result = await activate('   ', {
      storage: memoryStorage(),
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('empty-key');
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('validateCurrent', () => {
  it('refreshes an active license with its instance', async () => {
    const storage = memoryStorage({ [LICENSE_STORAGE_KEY]: stored() });
    const mock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(validationResponse),
    );
    const result = await validateCurrent({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.isPro).toBe(true);
    expect(result.snapshot?.status).toBe('active');

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain('/v1/licenses/validate');
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('license_key')).toBe(stored().key);
    expect(body.get('instance_id')).toBe('instance-1');
  });

  it('revokes Pro when Lemon Squeezy reports the key expired', async () => {
    const storage = memoryStorage({ [LICENSE_STORAGE_KEY]: stored() });
    const mock = vi.fn(async () =>
      jsonResponse({
        valid: false,
        error: 'license_key_expired',
        license_key: { status: 'expired' },
      }),
    );
    const result = await validateCurrent({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.snapshot?.isPro).toBe(false);
    expect(result.snapshot?.status).toBe('expired');
    expect((storage.data[LICENSE_STORAGE_KEY] as StoredLicense).status).toBe(
      'expired',
    );
  });

  it('keeps Pro inside the grace period when the network fails', async () => {
    const storage = memoryStorage({ [LICENSE_STORAGE_KEY]: stored() });
    const mock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await validateCurrent({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.offline).toBe(true);
    expect(result.snapshot?.isPro).toBe(true);
    expect(result.snapshot?.status).toBe('active');
  });

  it('expires Pro when the network fails after the grace period', async () => {
    const storage = memoryStorage({
      [LICENSE_STORAGE_KEY]: stored({
        validUntil: new Date(NOW - 1).toISOString(),
      }),
    });
    const mock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await validateCurrent({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.offline).toBe(true);
    expect(result.snapshot?.isPro).toBe(false);
    expect(result.snapshot?.status).toBe('expired');
  });

  it('does not grant Pro if this device was never activated', async () => {
    const storage = memoryStorage({
      [LICENSE_STORAGE_KEY]: stored({
        plan: 'free',
        status: 'active',
        instanceId: null,
      }),
    });
    const mock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(validationResponse),
    );
    const result = await validateCurrent({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.snapshot?.isPro).toBe(false);
    expect(result.snapshot?.status).toBe('inactive');
    expect(result.snapshot?.canActivate).toBe(true);
  });
});

describe('validateIfDue', () => {
  it('skips the API when the last check is under 24 hours old', async () => {
    const storage = memoryStorage({ [LICENSE_STORAGE_KEY]: stored() });
    const mock = vi.fn();
    const result = await validateIfDue({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result?.snapshot?.isPro).toBe(true);
    expect(mock).not.toHaveBeenCalled();
  });

  it('validates when the last check is older than 24 hours', async () => {
    const storage = memoryStorage({
      [LICENSE_STORAGE_KEY]: stored({
        lastValidatedAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const mock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(validationResponse),
    );
    const result = await validateIfDue({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result?.snapshot?.isPro).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe('deactivate', () => {
  it('clears the local state after a successful deactivation', async () => {
    const storage = memoryStorage({ [LICENSE_STORAGE_KEY]: stored() });
    const mock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ deactivated: true }),
    );
    const result = await deactivate({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.isPro).toBe(false);
    expect(storage.data[LICENSE_STORAGE_KEY]).toBeUndefined();

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain('/v1/licenses/deactivate');
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('instance_id')).toBe('instance-1');
  });

  it('keeps the state when Lemon Squeezy rejects the deactivation', async () => {
    const storage = memoryStorage({ [LICENSE_STORAGE_KEY]: stored() });
    const mock = vi.fn(async () =>
      jsonResponse({ deactivated: false, error: 'not-found' }),
    );
    const result = await deactivate({
      storage,
      fetchImpl: mock as unknown as typeof fetch,
      now: () => NOW,
    });

    expect(result.ok).toBe(false);
    expect(storage.data[LICENSE_STORAGE_KEY]).toBeDefined();
    expect((storage.data[LICENSE_STORAGE_KEY] as StoredLicense).key).toBe(
      stored().key,
    );
  });
});

describe('getLicenseSnapshot', () => {
  it('returns a Free snapshot without a stored key', async () => {
    const snapshot = await getLicenseSnapshot({
      storage: memoryStorage(),
      now: () => NOW,
    });
    expect(snapshot.plan).toBe('free');
    expect(snapshot.isPro).toBe(false);
  });

  it('derives Pro from a stored active license', async () => {
    const snapshot = await getLicenseSnapshot({
      storage: memoryStorage({ [LICENSE_STORAGE_KEY]: stored() }),
      now: () => NOW,
    });
    expect(snapshot.plan).toBe('pro');
    expect(snapshot.isPro).toBe(true);
    expect(snapshot.keyMasked).toBe('B1E8…0921');
  });
});

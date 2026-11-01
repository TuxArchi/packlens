export type LicensePlan = 'free' | 'pro';
export type LicenseStatus =
  | 'free'
  | 'inactive'
  | 'active'
  | 'expired'
  | 'disabled'
  | 'invalid';

export interface LicenseKeyInfo {
  id?: number;
  status?: string;
  key?: string;
  activation_limit?: number | null;
  activation_usage?: number | null;
  created_at?: string | null;
  expires_at?: string | null;
}

export interface LicenseInstanceInfo {
  id?: string;
  name?: string;
  created_at?: string;
}

export interface LicenseMeta {
  store_id?: number;
  order_id?: number;
  order_item_id?: number;
  product_id?: number;
  product_name?: string;
  variant_id?: number;
  variant_name?: string;
  customer_id?: number;
  customer_name?: string;
  customer_email?: string;
}

export interface LicenseApiResponse {
  valid?: boolean;
  activated?: boolean;
  deactivated?: boolean;
  error?: string | null;
  license_key?: LicenseKeyInfo;
  instance?: LicenseInstanceInfo | null;
  meta?: LicenseMeta;
}

export interface StoredLicense {
  key: string;
  plan: LicensePlan;
  status: LicenseStatus;
  instanceId: string | null;
  instanceName: string | null;
  variantId: number | null;
  variantName: string | null;
  activationLimit: number | null;
  activationUsage: number | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  validUntil: string | null;
  error: string | null;
}

export interface LicenseSnapshot {
  plan: LicensePlan;
  status: LicenseStatus;
  isPro: boolean;
  keyMasked: string;
  instanceId: string | null;
  variantId: number | null;
  variantName: string | null;
  activationLimit: number | null;
  activationUsage: number | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  offlineGraceUntil: string | null;
  error: string | null;
  canActivate: boolean;
  canDeactivate: boolean;
}

export interface LicenseStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface LicenseOptions {
  storage?: LicenseStorage | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
  instanceName?: string;
}

export interface LicenseResult {
  ok: boolean;
  state?: StoredLicense;
  snapshot?: LicenseSnapshot;
  error?: string;
  offline?: boolean;
}

export class LicenseApiError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'LicenseApiError';
    this.code = code;
  }
}

export const LICENSE_API_BASE = 'https://api.lemonsqueezy.com/v1/licenses';
export const LICENSE_STORAGE_KEY = 'packlens-license';
export const LICENSE_PRODUCT_ID = 1491549;
export const LICENSE_VARIANTS: Record<number, { plan: LicensePlan; name: string }> = {
  2323794: { plan: 'pro', name: 'PackLens Pro mensual' },
  2323795: { plan: 'pro', name: 'PackLens Pro anual' },
};

export const VALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const LICENSE_REQUEST_TIMEOUT_MS = 15_000;

type LicenseEndpoint = 'activate' | 'validate' | 'deactivate';

export function emptyLicense(): StoredLicense {
  return {
    key: '',
    plan: 'free',
    status: 'free',
    instanceId: null,
    instanceName: null,
    variantId: null,
    variantName: null,
    activationLimit: null,
    activationUsage: null,
    expiresAt: null,
    lastValidatedAt: null,
    validUntil: null,
    error: null,
  };
}

export function maskLicenseKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function newInstanceName(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `packlens-${random}`;
}

export function planForMeta(meta?: LicenseMeta | null): LicensePlan {
  if (!meta) return 'pro';
  if (typeof meta.product_id === 'number' && meta.product_id !== LICENSE_PRODUCT_ID) {
    return 'free';
  }
  if (
    typeof meta.variant_id === 'number' &&
    !Object.prototype.hasOwnProperty.call(LICENSE_VARIANTS, meta.variant_id)
  ) {
    return 'free';
  }
  return 'pro';
}

export function deriveLicenseSnapshot(
  current: StoredLicense,
  now: number = Date.now(),
): LicenseSnapshot {
  const hasKey = current.key.trim().length > 0;
  const graceEnd = current.validUntil ? Date.parse(current.validUntil) : Number.NaN;
  const withinGrace = Number.isFinite(graceEnd) && now <= graceEnd;
  const active =
    hasKey &&
    current.plan === 'pro' &&
    current.status === 'active' &&
    withinGrace;

  let status: LicenseStatus = current.status;
  if (!hasKey) {
    status = 'free';
  } else if (current.status === 'active' && !active) {
    status = current.plan === 'pro' ? 'expired' : 'inactive';
  }

  return {
    plan: active ? 'pro' : 'free',
    status,
    isPro: active,
    keyMasked: hasKey ? maskLicenseKey(current.key) : '',
    instanceId: current.instanceId,
    variantId: current.variantId,
    variantName: current.variantName,
    activationLimit: current.activationLimit,
    activationUsage: current.activationUsage,
    expiresAt: current.expiresAt,
    lastValidatedAt: current.lastValidatedAt,
    offlineGraceUntil: current.validUntil,
    error: current.error,
    canActivate: hasKey && status === 'inactive',
    canDeactivate: hasKey && current.instanceId != null,
  };
}

export async function loadLicense(storage: LicenseStorage): Promise<StoredLicense> {
  try {
    const stored = await storage.get(LICENSE_STORAGE_KEY);
    return normalizeStored(stored?.[LICENSE_STORAGE_KEY]);
  } catch {
    return emptyLicense();
  }
}

export async function saveLicense(
  state: StoredLicense,
  storage: LicenseStorage,
): Promise<void> {
  await storage.set({ [LICENSE_STORAGE_KEY]: state });
}

export async function clearLicense(storage: LicenseStorage): Promise<void> {
  await storage.remove(LICENSE_STORAGE_KEY);
}

export async function getLicenseSnapshot(
  options: LicenseOptions = {},
): Promise<LicenseSnapshot> {
  const now = options.now?.() ?? Date.now();
  const storage = options.storage ?? defaultStorage();
  if (!storage) return deriveLicenseSnapshot(emptyLicense(), now);
  const current = await loadLicense(storage);
  return deriveLicenseSnapshot(current, now);
}

export async function activate(
  key: string,
  options: LicenseOptions = {},
): Promise<LicenseResult> {
  const storage = options.storage ?? defaultStorage();
  if (!storage) return { ok: false, error: 'storage-unavailable' };

  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: 'empty-key' };

  const now = options.now?.() ?? Date.now();
  const instanceName = options.instanceName ?? newInstanceName();

  try {
    const response = await requestLicense(
      'activate',
      { license_key: trimmed, instance_name: instanceName },
      options.fetchImpl ?? fetch,
    );
    const state = stateFromActivation(trimmed, instanceName, response, now);
    if (!state) {
      return { ok: false, error: response.error || 'activation-failed' };
    }

    await saveLicense(state, storage);
    return {
      ok: true,
      state,
      snapshot: deriveLicenseSnapshot(state, now),
    };
  } catch (error) {
    return { ok: false, error: errorCode(error) };
  }
}

export async function validateCurrent(
  options: LicenseOptions = {},
): Promise<LicenseResult> {
  const storage = options.storage ?? defaultStorage();
  if (!storage) return { ok: false, error: 'storage-unavailable' };

  const now = options.now?.() ?? Date.now();
  const current = await loadLicense(storage);
  if (!current.key) {
    return {
      ok: true,
      state: current,
      snapshot: deriveLicenseSnapshot(current, now),
    };
  }

  try {
    const params: Record<string, string> = { license_key: current.key };
    if (current.instanceId) params.instance_id = current.instanceId;

    const response = await requestLicense(
      'validate',
      params,
      options.fetchImpl ?? fetch,
    );
    const next = stateFromValidation(current, response, now);
    await saveLicense(next, storage);
    return {
      ok: true,
      state: next,
      snapshot: deriveLicenseSnapshot(next, now),
      offline: false,
    };
  } catch (error) {
    const snapshot = deriveLicenseSnapshot(current, now);

    if (snapshot.isPro || current.status === 'inactive') {
      return {
        ok: true,
        state: current,
        snapshot: { ...snapshot, error: 'offline' },
        error: 'offline',
        offline: true,
      };
    }

    if (current.status === 'invalid' || current.status === 'disabled') {
      return {
        ok: true,
        state: current,
        snapshot: { ...snapshot, error: 'offline' },
        error: 'offline',
        offline: true,
      };
    }

    const expired: StoredLicense = {
      ...current,
      plan: 'free',
      status: 'expired',
      validUntil: null,
      error: 'offline',
    };
    await saveLicense(expired, storage);
    return {
      ok: true,
      state: expired,
      snapshot: deriveLicenseSnapshot(expired, now),
      error: errorCode(error),
      offline: true,
    };
  }
}

export async function validateIfDue(
  options: LicenseOptions = {},
): Promise<LicenseResult | null> {
  const storage = options.storage ?? defaultStorage();
  if (!storage) return null;

  const current = await loadLicense(storage);
  if (!current.key) return null;

  const now = options.now?.() ?? Date.now();
  if (current.lastValidatedAt) {
    const last = Date.parse(current.lastValidatedAt);
    if (Number.isFinite(last) && now - last < VALIDATE_INTERVAL_MS) {
      return {
        ok: true,
        state: current,
        snapshot: deriveLicenseSnapshot(current, now),
      };
    }
  }

  return validateCurrent({ ...options, storage, now: () => now });
}

export async function deactivate(
  options: LicenseOptions = {},
): Promise<LicenseResult> {
  const storage = options.storage ?? defaultStorage();
  if (!storage) return { ok: false, error: 'storage-unavailable' };

  const now = options.now?.() ?? Date.now();
  const current = await loadLicense(storage);
  const cleared = () => {
    const state = emptyLicense();
    return {
      ok: true,
      state,
      snapshot: deriveLicenseSnapshot(state, now),
    };
  };

  if (!current.key || !current.instanceId) {
    await clearLicense(storage);
    return cleared();
  }

  try {
    const response = await requestLicense(
      'deactivate',
      { license_key: current.key, instance_id: current.instanceId },
      options.fetchImpl ?? fetch,
    );
    if (!response.deactivated) {
      return { ok: false, error: response.error || 'deactivation-failed' };
    }

    await clearLicense(storage);
    return cleared();
  } catch (error) {
    return { ok: false, error: errorCode(error) };
  }
}

export async function activateLicenseKey(
  key: string,
  instanceName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseApiResponse> {
  return requestLicense(
    'activate',
    { license_key: key.trim(), instance_name: instanceName },
    fetchImpl,
  );
}

export async function validateLicenseKey(
  key: string,
  instanceId?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseApiResponse> {
  const params: Record<string, string> = { license_key: key.trim() };
  if (instanceId) params.instance_id = instanceId;
  return requestLicense('validate', params, fetchImpl);
}

export async function deactivateLicenseKey(
  key: string,
  instanceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseApiResponse> {
  return requestLicense(
    'deactivate',
    { license_key: key.trim(), instance_id: instanceId },
    fetchImpl,
  );
}

function stateFromActivation(
  key: string,
  instanceName: string,
  response: LicenseApiResponse,
  now: number,
): StoredLicense | null {
  const instance = response.instance;
  if (!response.activated || !instance?.id) return null;

  const meta = response.meta ?? {};
  const plan = planForMeta(meta);
  if (plan !== 'pro') return null;

  const licenseKey = response.license_key ?? {};
  return {
    key,
    plan,
    status: 'active',
    instanceId: instance.id,
    instanceName: instance.name ?? instanceName,
    variantId: numberOrNull(meta.variant_id),
    variantName: stringOrNull(meta.variant_name),
    activationLimit: numberOrNull(licenseKey.activation_limit),
    activationUsage: numberOrNull(licenseKey.activation_usage),
    expiresAt: stringOrNull(licenseKey.expires_at),
    lastValidatedAt: new Date(now).toISOString(),
    validUntil: new Date(now + OFFLINE_GRACE_MS).toISOString(),
    error: null,
  };
}

function stateFromValidation(
  current: StoredLicense,
  response: LicenseApiResponse,
  now: number,
): StoredLicense {
  const licenseKey = response.license_key ?? {};
  const meta = response.meta ?? {};
  const valid = response.valid === true;
  const rawStatus = normalizeStatus(licenseKey.status);
  const status: LicenseStatus = valid
    ? rawStatus
    : rawStatus === 'expired' || rawStatus === 'disabled'
      ? rawStatus
      : 'invalid';

  const plan =
    valid && status === 'active' && current.instanceId
      ? planForMeta(meta)
      : 'free';
  const next: StoredLicense = {
    ...current,
    plan,
    status,
    variantId: numberOrNull(meta.variant_id) ?? current.variantId,
    variantName: stringOrNull(meta.variant_name) ?? current.variantName,
    activationLimit:
      numberOrNull(licenseKey.activation_limit) ?? current.activationLimit,
    activationUsage:
      numberOrNull(licenseKey.activation_usage) ?? current.activationUsage,
    expiresAt: stringOrNull(licenseKey.expires_at) ?? current.expiresAt,
    lastValidatedAt: new Date(now).toISOString(),
    validUntil:
      plan === 'pro' && status === 'active'
        ? new Date(now + OFFLINE_GRACE_MS).toISOString()
        : null,
    error: valid
      ? null
      : stringOrNull(response.error) ?? status,
  };

  if (response.instance?.id) {
    next.instanceId = response.instance.id;
    next.instanceName = response.instance.name ?? next.instanceName;
  }

  return next;
}

function normalizeStored(value: unknown): StoredLicense {
  if (!value || typeof value !== 'object') return emptyLicense();

  const raw = value as Record<string, unknown>;
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  if (!key) return emptyLicense();

  return {
    key,
    plan: raw.plan === 'pro' ? 'pro' : 'free',
    status: isStoredStatus(raw.status) ? raw.status : 'inactive',
    instanceId: stringOrNull(raw.instanceId),
    instanceName: stringOrNull(raw.instanceName),
    variantId: numberOrNull(raw.variantId),
    variantName: stringOrNull(raw.variantName),
    activationLimit: numberOrNull(raw.activationLimit),
    activationUsage: numberOrNull(raw.activationUsage),
    expiresAt: stringOrNull(raw.expiresAt),
    lastValidatedAt: stringOrNull(raw.lastValidatedAt),
    validUntil: stringOrNull(raw.validUntil),
    error: stringOrNull(raw.error),
  };
}

function isStoredStatus(value: unknown): value is LicenseStatus {
  return (
    value === 'inactive' ||
    value === 'active' ||
    value === 'expired' ||
    value === 'disabled' ||
    value === 'invalid'
  );
}

function normalizeStatus(value: unknown): LicenseStatus {
  if (
    value === 'active' ||
    value === 'inactive' ||
    value === 'expired' ||
    value === 'disabled' ||
    value === 'invalid'
  ) {
    return value;
  }
  return 'invalid';
}

async function requestLicense(
  endpoint: LicenseEndpoint,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<LicenseApiResponse> {
  const timeout = (
    AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }
  ).timeout;
  const signal = timeout ? timeout(LICENSE_REQUEST_TIMEOUT_MS) : undefined;

  const response = await fetchImpl(`${LICENSE_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
    signal,
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `http-${response.status}`;
    throw new LicenseApiError(message);
  }

  if (!body || typeof body !== 'object') {
    throw new LicenseApiError('invalid-response');
  }

  return body as LicenseApiResponse;
}

function defaultStorage(): LicenseStorage | null {
  try {
    const global = globalThis as {
      browser?: { storage?: { local?: LicenseStorage } };
    };
    return (global.browser?.storage?.local as LicenseStorage | undefined) ?? null;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function errorCode(error: unknown): string {
  if (error instanceof LicenseApiError) return error.code;
  if (error instanceof TypeError) return 'network';
  if (error instanceof Error) {
    return error.name === 'AbortError' ? 'timeout' : error.message;
  }
  return String(error);
}

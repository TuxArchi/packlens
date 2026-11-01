/**
 * Public checkout links. The variant slugs are stable in Lemon Squeezy, so
 * renaming a variant does not change its URL.
 */
export const CHECKOUT_URLS = {
  monthly:
    'https://packlens.lemonsqueezy.com/checkout/buy/7b187f62-e4aa-476d-879b-ddc06e6fd756?embed=1',
  annual:
    'https://packlens.lemonsqueezy.com/checkout/buy/9509ceb0-b47b-4e95-bfc8-6db4fb67b621?embed=1',
} as const;

/**
 * Founding prices in MXN. Update these when the founding period ends.
 */
export const PRICES = {
  monthly: '99 MXN',
  annual: '998 MXN',
} as const;

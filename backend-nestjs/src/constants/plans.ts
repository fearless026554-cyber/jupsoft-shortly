// ============================================================================
// Canonical Tenant Subscription Plans
// ============================================================================

export const SubscriptionPlans = {
  INTERNAL_UNLIMITED: 'internal_unlimited',
  STANDARD: 'standard',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionPlanType = (typeof SubscriptionPlans)[keyof typeof SubscriptionPlans];

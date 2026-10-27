/**
 * Marks a single onboarding step completed for a customer and recomputes progress.
 */

const { calculateProgress } = require('./models');

const STEP_NAMES = {
  'customer-info': 'Customer Info',
  'data-mapping': 'Data Mapping',
  'tenant-setup': 'Tenant Setup',
  import: 'Import'
};

/** @returns {{ error?: {status: number, message: string}, onboarding?: object }} */
function completeStep(store, customerId, stepKey) {
  const name = STEP_NAMES[stepKey];
  if (!name) return { error: { status: 400, message: `Unknown step "${stepKey}"` } };
  const state = store.getOnboardingState(customerId);
  if (!state) return { error: { status: 404, message: 'Onboarding state not found' } };

  const steps = state.steps.map(s => (s.name === name ? { ...s, status: 'completed' } : s));
  const onboarding = store.updateOnboardingState(customerId, { steps, progressPercent: calculateProgress(steps) });
  return { onboarding };
}

module.exports = { completeStep, STEP_NAMES };

const { test } = require('node:test');
const assert = require('node:assert');
const store = require('./data/store');
const { completeStep } = require('./onboardingSteps');

test('completeStep marks the step and updates progress', () => {
  const { onboarding, error } = completeStep(store, 'cust_001', 'data-mapping');
  assert.strictEqual(error, undefined);
  assert.strictEqual(onboarding.steps.find(s => s.name === 'Data Mapping').status, 'completed');
  assert.strictEqual(onboarding.progressPercent, 25);
});

test('completeStep is idempotent and rejects unknown step/customer', () => {
  completeStep(store, 'cust_001', 'import');
  assert.strictEqual(completeStep(store, 'cust_001', 'import').onboarding.steps.find(s => s.name === 'Import').status, 'completed');
  assert.strictEqual(completeStep(store, 'cust_001', 'bogus').error.status, 400);
  assert.strictEqual(completeStep(store, 'nope', 'import').error.status, 404);
});

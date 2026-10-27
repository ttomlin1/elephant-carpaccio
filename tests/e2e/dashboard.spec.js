// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Onboarding step completion', () => {
  test('confirming mapping and importing mark their steps complete on the dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.getByLabel('Customer name').fill('Steps Flow Test');
    await page.getByLabel('Industry').fill('Finance');
    await page.getByLabel('Region').fill('NA');
    await page.getByLabel('Contact email').fill('ops@stepsflow.example');
    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.getByTestId('intake-success')).toBeVisible();

    await page.locator('.tab', { hasText: 'Data Mapping' }).click();
    await page.getByLabel('Customer').selectOption({ label: 'Steps Flow Test' });
    await page.getByRole('button', { name: 'Confirm mapping' }).click();
    await expect(page.getByText('Mapping confirmed')).toBeVisible();

    await page.locator('.tab', { hasText: 'Import' }).click();
    await page.getByLabel('Customer').selectOption({ label: 'Steps Flow Test' });
    await page.getByRole('button', { name: 'Import clients' }).click();
    await expect(page.getByTestId('import-summary')).toBeVisible();

    await page.locator('.tab', { hasText: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: 'Steps Flow Test' });
    await expect(card.locator('.progress-bar')).toContainText('75%');
  });
});

test.describe('Tenant setup', () => {
  test('provisions a new customer end to end and shows 50% on the dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.getByLabel('Customer name').fill('Tenant Flow Test');
    await page.getByLabel('Industry').fill('Retail');
    await page.getByLabel('Region').fill('APAC');
    await page.getByLabel('Contact email').fill('it@tenantflow.example');
    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.getByTestId('intake-success')).toBeVisible();

    // Dashboard shows contact info, and the Tenant Setup step links to its tab
    await page.locator('.tab', { hasText: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: 'Tenant Flow Test' });
    await expect(card).toContainText('it@tenantflow.example');
    await card.getByRole('link', { name: 'Tenant Setup' }).click();

    await page.getByLabel('Plan for Tenant Flow Test').selectOption('enterprise');
    await page.getByRole('button', { name: 'Provision Tenant Flow Test' }).click();
    const row = page.getByTestId('tenants-table').locator('tr', { hasText: 'Tenant Flow Test' });
    await expect(row).toContainText('active');
    await expect(row).toContainText('enterprise');

    await page.locator('.tab', { hasText: 'Dashboard' }).click();
    await expect(page.locator('.customer-card', { hasText: 'Tenant Flow Test' }).locator('.progress-bar')).toContainText('50%');
  });
});

test.describe('Customer intake', () => {
  test('validates, then adds a customer to the queue at 25%', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();

    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.getByRole('alert').first()).toContainText('required');

    await page.getByLabel('Customer name').fill('Globex Intake Test');
    await page.getByLabel('Industry').fill('Energy');
    await page.getByLabel('Region').fill('EMEA');
    await page.getByLabel('Contact email').fill('ops@globex.example');
    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.getByTestId('intake-success')).toContainText('Globex Intake Test');

    await page.locator('.tab', { hasText: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: 'Globex Intake Test' });
    await expect(card).toBeVisible();
    await expect(card.locator('.progress-bar')).toContainText('25%');
  });
});

test.describe('Customer A import', () => {
  test('imports and normalizes ABC Accounting clients', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tab', { hasText: 'Import' }).click();
    await page.getByRole('button', { name: 'Import clients' }).click();

    await expect(page.getByTestId('import-summary')).toContainText('0 rejected');
    const clientRow = page.getByTestId('clients-table').locator('tbody tr', { hasText: 'C001' });
    await expect(clientRow).toContainText('2023-01-15');
    await expect(clientRow).toContainText('active');
  });

  test('imports a selected CSV into saved clients and reads it after refresh', async ({ page }) => {
    const clientId = `DEMO-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const csvText = [
      'Client ID,Client Name,Business Type,Status,Date Onboarded',
      `${clientId},Selected Client,LLC,Active,10/27/2026`
    ].join('\n');
    await page.goto('/');
    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'selected-clients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvText)
    });

    await expect(page.getByText('Previewing selected-clients.csv before import.')).toBeVisible();
    await page.getByRole('button', { name: 'Import selected clients' }).click();
    await expect(page.getByRole('status')).toContainText('1 imported');
    await expect(page.locator('.imported-clients')).toContainText(`${clientId} — Selected Client`);

    const saved = await page.request.get('/api/clients');
    expect((await saved.json()).find(client => client.id === clientId)).toMatchObject({
      name: 'Selected Client', entityType: 'llc', status: 'active'
    });

    await page.reload();
    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await expect(page.locator('.imported-clients')).toContainText(`${clientId} — Selected Client`);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByTestId('clients-table')).toContainText(clientId);

    const repeat = await page.request.post('/api/import/customer-a/clients', { data: { csvText } });
    expect((await repeat.json()).imported).toBe(0);
  });
});

test.describe('Onboarding Dashboard', () => {
  test('should display the dashboard heading', async ({ page }) => {
    await page.goto('/');

    // Verify the main heading is visible
    await expect(page.locator('h1')).toContainText('Onboarding Dashboard');
  });

  test('should show navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Verify all navigation tabs are present
    await expect(page.locator('.tab')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Customer Info' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data Mapping' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tenant Setup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  });

  test('should display example customer in onboarding queue', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load and verify example customer is shown
    await expect(page.locator('.customer-card h3', { hasText: 'Acme Corporation' })).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/');

    // Click on Customer Info tab
    await page.getByRole('button', { name: 'Customer Info' }).click();
    
    // Verify the tab content is shown
    await expect(page.locator('h2')).toContainText('Customer Info');
  });

  test('shows a mapped preview of ABC Accounting clients', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Data Mapping' }).click();

    await expect(page.getByText('ABC Accounting clients.csv')).toBeVisible();
    await expect(page.getByText('10 rows · 10 ID/name ready · 0 need attention')).toBeVisible();
    await expect(page.getByText('Client ID → clientId')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Riverside Manufacturing LLC' })).toBeVisible();
  });
});

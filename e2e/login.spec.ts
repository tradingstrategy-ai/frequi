import { test, expect } from '@playwright/test';
import { defaultMocks } from './helpers';

test.describe('Login', () => {
  test('Is not logged in', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button', { hasText: 'Login' })).toBeInViewport();

    await page.locator('li', { hasText: 'No bot selected' });
    await page.locator('button:has-text("Login")').click();
    await page.locator('.modal-title:has-text("Login to your bot")');
    // Test prefilled URL
    await expect(page.locator('input[id=url-input]').inputValue()).resolves.toBe(
      'http://localhost:3000',
    );
    await page.locator('#name-input').isVisible();
    await page.locator('#username-input').isVisible();
    await page.locator('#password-input').isVisible();
    await expect(page.locator('button[type=submit]')).toBeVisible();
  });

  test('Explicit login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button', { hasText: 'Login' })).not.toBeInViewport();
    await expect(page.getByRole('link', { name: 'Connect to reports' })).toHaveAttribute(
      'href',
      '/api/bots/auth-bootstrap',
    );
    await page.locator('li', { hasText: 'No bot selected' });
    await page.locator('.card-header:has-text("Freqtrade bot Login")');
    // Test prefilled URL
    await expect(page.locator('input[id=url-input]').inputValue()).resolves.toBe(
      'http://localhost:3000',
    );
    await page.locator('input[id=name-input]').isVisible();
    await page.locator('input[id=username-input]').isVisible();
    await page.locator('input[id=password-input]').isVisible();
    await page.locator('button[type=submit]').isVisible();
  });

  test('Redirect when not logged in', async ({ page }) => {
    await page.goto('/trade');
    // await expect(page.locator('button', { hasText: 'Login' })).toBeInViewport();
    await expect(page.getByText('No bot selected')).toBeInViewport();
    await expect(page).toHaveURL(/.*\/login\?redirect=\/trade/);
  });
  test('Test Login', async ({ page }) => {
    await defaultMocks(page);
    await page.goto('/login');
    await page.locator('.card-header:has-text("Freqtrade bot Login")');

    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');

    await page.route('**/api/v1/token/login', (route) => {
      return route.fulfill({
        status: 200,
        json: { access_token: 'access_token_tesst', refresh_token: 'refresh_test' },
        headers: { 'access-control-allow-origin': '*' },
      });
    });
    const loginButton = await page.locator('button[type=submit]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('Submit');
    await Promise.all([loginButton.click(), page.waitForResponse('**/api/v1/token/login')]);

    await expect(page.getByText('TestBot', { exact: true })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Add new Bot' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Login' })).not.toBeVisible();
    // Test logout
    await page.getByRole('button', { name: 'FT' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    // Assert we're logged out again
    await expect(page.locator('button', { hasText: 'Login' })).toBeVisible();
  });

  test('successful login preserves the dashboard redirect', async ({ page }) => {
    await defaultMocks(page);
    await page.goto('/login?redirect=/dashboard');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');
    await page.route('**/api/v1/token/login', (route) =>
      route.fulfill({
        status: 200,
        json: { access_token: 'access_token_test', refresh_token: 'refresh_test' },
      }),
    );

    const loginRequest = page.waitForResponse('**/api/v1/token/login');
    await page.locator('button[type=submit]').click();
    await loginRequest;
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('empty API URL is reported as a validation error without sending a request', async ({
    page,
  }) => {
    await defaultMocks(page);
    let loginRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/token/login')) loginRequestCount += 1;
    });
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'API Url' }).fill('');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');

    await page.locator('button[type=submit]').click();
    await expect(page.getByText('API URL is required.')).toBeVisible();
    expect(loginRequestCount).toBe(0);
  });

  test('login reports an unreachable API as a reachability error', async ({ page }) => {
    await defaultMocks(page);
    await page.goto('/login');
    await page.locator('.card-header:has-text("Freqtrade bot Login")');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');

    await page.route('**/api/v1/token/login', (route) => {
      return route.fulfill({
        status: 502,
        json: { detail: 'Bad Gateway' },
      });
    });
    const loginButton = await page.locator('button[type=submit]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('Submit');
    await Promise.all([loginButton.click(), page.waitForResponse('**/api/v1/token/login')]);
    await expect(page.getByText('Login failed')).toBeVisible();
    await expect(page.getByText(/API URL is required/i)).not.toBeVisible();
    await expect(page.getByText(/URL is reachable|could not reach|unreachable/i)).toBeVisible();
  });

  test('reports authentication failure blocks bot login and offers bootstrap recovery', async ({
    page,
  }) => {
    await defaultMocks(page);
    let loginRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/token/login')) loginRequestCount += 1;
    });
    await page.route('**/api/bots/auth-check', (route) =>
      route.fulfill({
        status: 401,
        headers: { 'www-authenticate': 'Basic realm="restricted"' },
        json: { detail: 'Authentication required' },
      }),
    );

    await page.goto('/login');
    // Only the proxied routes are gated on reports auth.
    await page.getByRole('textbox', { name: 'API Url' }).fill('/api/bots/apex');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');
    await page.locator('button[type=submit]').click();

    await expect(
      page.getByText('Reports authentication is required before connecting to a bot.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connect to reports' }).last()).toHaveAttribute(
      'href',
      '/api/bots/auth-bootstrap',
    );
    expect(loginRequestCount).toBe(0);
  });

  test('a direct bot URL logs in without the reports preflight', async ({ page }) => {
    await defaultMocks(page);
    let authCheckCount = 0;
    let botAuthorizationHeader: string | undefined;
    let authorizationHeader: string | undefined;
    page.on('request', (request) => {
      if (request.url().includes('/api/bots/auth-check')) authCheckCount += 1;
    });
    await page.route('**/api/v1/token/login', (route) => {
      const headers = route.request().headers();
      botAuthorizationHeader = headers['x-bot-authorization'];
      authorizationHeader = headers['authorization'];
      return route.fulfill({
        status: 200,
        json: { access_token: 'access_token_test', refresh_token: 'refresh_test' },
      });
    });

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'API Url' }).fill('http://localhost:3000');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');
    await Promise.all([
      page.locator('button[type=submit]').click(),
      page.waitForResponse('**/api/v1/token/login'),
    ]);

    // A non-proxy bot must not be gated on a Caddy route that does not exist
    // for it, and keeps its credentials in the standard header.
    expect(authCheckCount).toBe(0);
    expect(botAuthorizationHeader).toBeUndefined();
    expect(authorizationHeader).toMatch(/^Basic /);
  });

  test('a proxied bot login relays credentials in X-Bot-Authorization', async ({ page }) => {
    await defaultMocks(page);
    let botAuthorizationHeader: string | undefined;
    let authorizationHeader: string | undefined;
    await page.route('**/api/bots/auth-check', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/api/bots/apex/api/v1/token/login', (route) => {
      const headers = route.request().headers();
      botAuthorizationHeader = headers['x-bot-authorization'];
      authorizationHeader = headers['authorization'];
      return route.fulfill({
        status: 200,
        json: { access_token: 'access_token_test', refresh_token: 'refresh_test' },
      });
    });

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'API Url' }).fill('/api/bots/apex');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');
    await Promise.all([
      page.locator('button[type=submit]').click(),
      page.waitForResponse('**/api/bots/apex/api/v1/token/login'),
    ]);

    // Authorization is left to the browser-managed reports BasicAuth, which
    // Playwright does not set here - so the bot credential must be the custom
    // header and nothing else.
    expect(botAuthorizationHeader).toBe('Basic RnJlcXRyYWRlcjpTdXBlckR1cGVyQm90');
    expect(authorizationHeader).toBeUndefined();
  });

  test('Test Login failed - wrong password', async ({ page }) => {
    await defaultMocks(page);
    await page.goto('/login');
    await page.locator('.card-header:has-text("Freqtrade bot Login")');
    await page.getByRole('textbox', { name: 'Bot Name' }).fill('TestBot');
    await page.getByRole('textbox', { name: 'Username' }).fill('Freqtrader');
    await page.getByRole('textbox', { name: 'Password' }).fill('SuperDuperBot');

    await page.route('**/api/v1/token/login', (route) => {
      return route.fulfill({
        status: 401,
        json: { access_token: 'access_token_tesst', refresh_token: 'refresh_test' },
        headers: { 'access-control-allow-origin': '*' },
      });
    });

    const loginButton = await page.locator('button[type=submit]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('Submit');
    await expect(page.getByText('Name and Password are required.')).not.toBeVisible();
    await expect(page.getByText('Connected to bot, however Login failed,')).not.toBeVisible();
    await expect(page.getByText('Invalid Password')).not.toBeVisible();

    await Promise.all([loginButton.click(), page.waitForResponse('**/api/v1/token/login')]);
    await expect(
      page.getByText(/username or password|invalid credentials|credentials/i),
    ).toBeVisible();
    await expect(page.getByText(/API URL is required/i)).not.toBeVisible();
    await expect(page.getByText(/URL is reachable|could not reach|unreachable/i)).not.toBeVisible();
  });
});

import test from 'node:test';
import assert from 'node:assert';
import { PlaywrightBrowserLaunchPolicy } from './PlaywrightBrowserLaunchPolicy.js';

test('PlaywrightBrowserLaunchPolicy - Stealth ON', () => {
  const policy = new PlaywrightBrowserLaunchPolicy('development', true);
  const result = policy.getLaunchOptions('worker');

  assert.strictEqual(result.launchOptions.headless, true);
  assert.ok(result.launchOptions.args.includes('--disable-blink-features=AutomationControlled'));
  assert.ok(result.launchOptions.args.includes('--disable-web-security'));
  
  assert.strictEqual(result.initScripts.length, 1);
  assert.ok(result.initScripts[0].source.includes('navigator'));
  assert.ok(result.initScripts[0].source.includes('webdriver'));
});

test('PlaywrightBrowserLaunchPolicy - Stealth OFF', () => {
  const policy = new PlaywrightBrowserLaunchPolicy('development', false);
  const result = policy.getLaunchOptions('worker');

  assert.strictEqual(result.launchOptions.headless, true);
  assert.ok(!result.launchOptions.args.includes('--disable-blink-features=AutomationControlled'));
  assert.ok(!result.launchOptions.args.includes('--disable-web-security'));
  
  assert.strictEqual(result.initScripts.length, 0);
});

test('PlaywrightBrowserLaunchPolicy - Production environment configuration', () => {
  const policy = new PlaywrightBrowserLaunchPolicy('production', true);
  const result = policy.getLaunchOptions('worker');

  assert.ok(result.launchOptions.args.includes('--disable-dev-shm-usage'));
  assert.ok(result.launchOptions.args.includes('--disable-gpu'));
});

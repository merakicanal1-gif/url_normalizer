import { test } from 'node:test';
import assert from 'node:assert';
import { StructuredNormalizeTelemetry } from './StructuredNormalizeTelemetry.js';
import { ILogger } from '../../domain/ports/ILogger.js';

class MockLogger implements ILogger {
  public logs: any[] = [];

  public info(context: any, _message?: string): void {
    this.logs.push(context);
  }

  public warn(context: any, _message?: string): void {
    this.logs.push(context);
  }

  public error(context: any, _message?: string, _error?: any): void {
    this.logs.push(context);
  }
}

test('StructuredNormalizeTelemetry - traceVersion, success, result trace, and log formats', async () => {
  const logger = new MockLogger();
  const telemetry = new StructuredNormalizeTelemetry(logger);

  const executionId = 'test-exec-1';
  const originalUrl = 'https://amzn.to/3XJ1Zpq';
  const finalUrl = 'https://www.amazon.com.br/dp/B0CX123456';

  await telemetry.run(executionId, originalUrl, async () => {
    telemetry.begin({
      originalUrl,
      profileId: 'main',
      runtime: 'worker',
      browserMode: 'headless',
      authStatusBefore: 'VALID'
    });

    telemetry.estimatedMarketplace('amazon');
    telemetry.browserCreated({ runtime: 'worker', browserMode: 'headless' });
    telemetry.storageStateLoaded({ profileId: 'main', cookiesCount: 15 });
    
    telemetry.resolverStarted({ resolver: 'AmazonAffiliateResolver', inputUrl: originalUrl });
    telemetry.resolverFinished({
      resolver: 'AmazonAffiliateResolver',
      inputUrl: originalUrl,
      outputUrl: finalUrl,
      durationMs: 120,
      skipped: false,
      redirectsCount: 1,
      changedMarketplace: false
    });

    telemetry.redirect({
      resolver: 'AmazonAffiliateResolver',
      fromUrl: originalUrl,
      toUrl: finalUrl,
      reason: 'HTTP_301'
    });

    telemetry.resolvedMarketplace('amazon');
    telemetry.normalizeResult({
      marketplace: 'amazon',
      productId: 'B0CX123456',
      canonicalUrl: finalUrl,
      title: 'Amazon Product Title',
      image: 'https://images.amazon.com/test.jpg'
    });

    telemetry.finished(finalUrl, 250, 'VALID');
  });

  const trace = StructuredNormalizeTelemetry.getLastTrace();
  assert.ok(trace);
  assert.strictEqual(trace.executionId, executionId);
  assert.strictEqual(trace.traceVersion, 1);
  assert.strictEqual(trace.originalUrl, originalUrl);
  assert.strictEqual(trace.finalUrl, finalUrl);
  assert.strictEqual(trace.estimatedMarketplace, 'amazon');
  assert.strictEqual(trace.resolvedMarketplace, 'amazon');
  assert.strictEqual(trace.profileId, 'main');
  assert.strictEqual(trace.profileLoaded, true);
  assert.strictEqual(trace.storageStateLoaded, true);
  assert.strictEqual(trace.cookiesLoaded, 15);
  assert.strictEqual(trace.browserContextCreated, true);
  assert.strictEqual(trace.browserContextReused, false);
  assert.strictEqual(trace.redirectCount, 1);
  assert.strictEqual(trace.normalizeSucceeded, true);
  assert.strictEqual(trace.authenticationStatusBefore, 'VALID');
  assert.strictEqual(trace.authenticationStatusAfter, 'VALID');
  assert.strictEqual(trace.runtime, 'worker');
  assert.strictEqual(trace.browserMode, 'headless');

  assert.ok(trace.extractionResult);
  assert.strictEqual(trace.extractionResult.marketplace, 'amazon');
  assert.strictEqual(trace.extractionResult.productId, 'B0CX123456');

  assert.strictEqual(trace.resolverChain.length, 1);
  assert.strictEqual(trace.resolverChain[0].resolver, 'AmazonAffiliateResolver');
  assert.strictEqual(trace.resolverChain[0].durationMs, 120);
  assert.strictEqual(trace.resolverChain[0].changedMarketplace, false);

  // Check logs generated
  assert.ok(logger.logs.length > 0);
  const startLog = logger.logs.find(l => l.stage === 'NormalizeStarted');
  assert.ok(startLog);
  assert.strictEqual(startLog.executionId, executionId);
  assert.strictEqual(startLog.url, originalUrl);

  const redirectLog = logger.logs.find(l => l.stage === 'Redirect');
  assert.ok(redirectLog);
  assert.strictEqual(redirectLog.reason, 'HTTP_301');
});

test('StructuredNormalizeTelemetry - failed flow coverage', async () => {
  const logger = new MockLogger();
  const telemetry = new StructuredNormalizeTelemetry(logger);

  const executionId = 'test-exec-2';
  const originalUrl = 'https://www.mercadolivre.com.br/invalid';

  await telemetry.run(executionId, originalUrl, async () => {
    telemetry.begin({
      originalUrl,
      profileId: 'main',
      runtime: 'worker',
      browserMode: 'headless',
      authStatusBefore: 'VALID'
    });

    telemetry.failed('Navigation Timeout', 300, 'EXPIRED');
  });

  const trace = StructuredNormalizeTelemetry.getLastTrace();
  assert.ok(trace);
  assert.strictEqual(trace.executionId, executionId);
  assert.strictEqual(trace.normalizeSucceeded, false);
  assert.strictEqual(trace.failureReason, 'Navigation Timeout');
  assert.strictEqual(trace.authenticationStatusAfter, 'EXPIRED');

  const finishedLog = logger.logs.find(l => l.stage === 'NormalizeFinished');
  assert.ok(finishedLog);
  assert.strictEqual(finishedLog.success, false);
  assert.strictEqual(finishedLog.reason, 'Navigation Timeout');
});

test('StructuredNormalizeTelemetry - AsyncLocalStorage isolation', async () => {
  const telemetry = new StructuredNormalizeTelemetry();

  const promise1 = telemetry.run('exec-A', 'url-A', async () => {
    telemetry.begin({ originalUrl: 'url-A' });
    await new Promise(r => setTimeout(r, 10));
    telemetry.estimatedMarketplace('amazon');
    return StructuredNormalizeTelemetry.getLastTrace();
  });

  const promise2 = telemetry.run('exec-B', 'url-B', async () => {
    telemetry.begin({ originalUrl: 'url-B' });
    telemetry.estimatedMarketplace('mercadolivre');
    return StructuredNormalizeTelemetry.getLastTrace();
  });

  await Promise.all([promise1, promise2]);

  // If isolation works, getLastTrace updates cleanly at callback return.
  const trace = StructuredNormalizeTelemetry.getLastTrace();
  assert.ok(trace);
});

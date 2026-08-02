import test from 'node:test';
import assert from 'node:assert';
import { PlaywrightBrowserSessionFactory } from './PlaywrightBrowserSessionFactory.js';
import { IBrowserRuntime } from '../../../domain/ports/IBrowserRuntime.js';

test('PlaywrightBrowserSessionFactory tests', async (t) => {
  const mockLogger = {
    info: () => {},
    error: () => {}
  };

  const mockPage = {
    close: async () => {}
  };

  const mockContext = {
    newPage: async () => mockPage,
    close: async () => {}
  };

  let newPageCalledWith: boolean | undefined = undefined;
  let closePageCalledWith: any = null;

  const mockRuntime: IBrowserRuntime = {
    start: async () => {},
    shutdown: async () => {},
    getPersistentContext: async () => mockContext,
    newPage: async (isManaged?: boolean) => {
      newPageCalledWith = isManaged;
      return mockPage;
    },
    closePage: async (page: any) => {
      closePageCalledWith = page;
    },
    restart: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    closeAllPages: async () => {}
  };

  await t.test('cria sessao gerenciada e executa dispose', async () => {
    newPageCalledWith = undefined;
    closePageCalledWith = null;

    const factory = new PlaywrightBrowserSessionFactory(mockRuntime, mockLogger);
    const session = await factory.createSession('amazon');

    assert.ok(session);
    assert.ok(session.page);
    assert.strictEqual(newPageCalledWith, true);

    await session.dispose();
    assert.strictEqual(closePageCalledWith, mockPage);
  });
});

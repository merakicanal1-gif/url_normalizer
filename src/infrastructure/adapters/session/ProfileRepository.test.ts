import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { LocalFileProfileRepository } from './LocalFileProfileRepository.js';
import { SecureCryptoHelper } from './SecureCryptoHelper.js';

test('LocalFileProfileRepository & SecureCryptoHelper integration tests', async (t) => {
  const tmpDir = path.join(process.cwd(), 'data', 'test-profiles-dir');
  const cryptoHelper = new SecureCryptoHelper('test-key:another-secret-key-12345');
  const repository = new LocalFileProfileRepository(cryptoHelper, tmpDir);

  // Setup/Cleanup hooks
  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test('grava metadata.json em texto simples e storageState.enc criptografado', async () => {
    const marketplace = 'amazon';
    const profileId = 'amazon-test-profile';

    const testMetadata = {
      createdAt: new Date().toISOString(),
      marketplace,
      profileId,
      version: 1
    };

    const testStorageState = {
      cookies: [{ name: 'session-id', value: 'xyz123', domain: '.amazon.com.br', path: '/' }],
      origins: []
    };

    await repository.save(marketplace, profileId, testMetadata, testStorageState);

    // 1. Validar existência física dos arquivos e diretórios
    const profilePath = path.join(tmpDir, marketplace, profileId);
    assert.strictEqual(fsSync.existsSync(profilePath), true);
    assert.strictEqual(fsSync.existsSync(path.join(profilePath, 'metadata.json')), true);
    assert.strictEqual(fsSync.existsSync(path.join(profilePath, 'storageState.enc')), true);

    // 2. Validar que metadata.json está em texto plano legível
    const metaContent = await fs.readFile(path.join(profilePath, 'metadata.json'), 'utf8');
    const metaObj = JSON.parse(metaContent);
    assert.strictEqual(metaObj.profileId, profileId);
    assert.strictEqual(metaObj.version, 1);

    // 3. Validar que storageState.enc está criptografado (salvo como envelope)
    const encContent = await fs.readFile(path.join(profilePath, 'storageState.enc'), 'utf8');
    const parsedEnvelope = JSON.parse(encContent);
    assert.ok(parsedEnvelope.ciphertext);
    assert.ok(parsedEnvelope.iv);
    assert.ok(parsedEnvelope.authTag);
    assert.strictEqual(parsedEnvelope.cookies, undefined);

    // 4. Carregar via repositório e descriptografar automaticamente
    const loaded = await repository.load(marketplace, profileId);
    assert.ok(loaded);
    assert.deepEqual(loaded?.metadata, testMetadata);
    assert.deepEqual(loaded?.storageState, testStorageState);

    // 5. Listagem de perfis cadastrados
    const list = await repository.list();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, profileId);
    assert.strictEqual(list[0].marketplace, marketplace);

    // 6. Remoção de perfil
    await repository.delete(marketplace, profileId);
    assert.strictEqual(fsSync.existsSync(profilePath), false);
  });
});

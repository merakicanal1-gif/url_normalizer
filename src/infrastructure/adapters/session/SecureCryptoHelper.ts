import * as crypto from 'crypto';

export class SecureCryptoHelper {
  private keyMap: Map<string, Buffer> = new Map();
  private activeKeyId: string = '';

  constructor(keysConfig?: string) {
    const config = keysConfig || process.env.SESSION_ENCRYPTION_KEYS || process.env.SESSION_ENCRYPTION_KEY || 'default:dev-fallback-key-change-this-in-prod';
    this.parseKeys(config);
  }

  private parseKeys(config: string): void {
    const pairs = config.split(',');
    for (const pair of pairs) {
      const separatorIdx = pair.indexOf(':');
      let keyId = 'default';
      let secret = pair;
      if (separatorIdx !== -1) {
        keyId = pair.substring(0, separatorIdx).trim();
        secret = pair.substring(separatorIdx + 1).trim();
      }
      // Deriva uma chave AES-256 (32 bytes) usando SHA-256 para evitar restrições de tamanho de chave
      const keyBuffer = crypto.createHash('sha256').update(secret).digest();
      this.keyMap.set(keyId, keyBuffer);
      if (!this.activeKeyId) {
        this.activeKeyId = keyId; // A primeira chave configurada torna-se a chave ativa de escrita
      }
    }
  }

  public encrypt(plaintext: string): string {
    if (!this.activeKeyId) {
      throw new Error('[SecureCryptoHelper] Nenhuma chave de criptografia ativa configurada.');
    }
    const key = this.keyMap.get(this.activeKeyId);
    if (!key) {
      throw new Error(`[SecureCryptoHelper] Chave ativa "${this.activeKeyId}" não encontrada no chaveiro.`);
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const envelope = {
      keyId: this.activeKeyId,
      iv: iv.toString('hex'),
      authTag: authTag,
      ciphertext: ciphertext
    };

    return JSON.stringify(envelope);
  }

  public decrypt(envelopeJson: string): { plaintext: string; migrated: boolean } {
    let envelope: any;
    try {
      envelope = JSON.parse(envelopeJson);
    } catch (e) {
      throw new Error('[SecureCryptoHelper] Formato de envelope criptográfico inválido (JSON corrompido).');
    }

    const { keyId, iv, authTag, ciphertext } = envelope;
    if (!keyId || !iv || !authTag || !ciphertext) {
      throw new Error('[SecureCryptoHelper] Envelope criptográfico incompleto.');
    }

    const key = this.keyMap.get(keyId);
    if (!key) {
      throw new Error(`[SecureCryptoHelper] Chave de descriptografia com ID "${keyId}" não encontrada no chaveiro.`);
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    const migrated = keyId !== this.activeKeyId;

    return { plaintext, migrated };
  }
}

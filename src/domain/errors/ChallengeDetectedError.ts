export class ChallengeDetectedError extends Error {
  constructor(
    message: string,
    public readonly type: 'CAPTCHA' | 'WAF' | 'CONSENT' | 'LOGIN' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'ChallengeDetectedError';
  }
}

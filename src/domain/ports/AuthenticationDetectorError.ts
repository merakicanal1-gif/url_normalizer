export class AuthenticationDetectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationDetectorError';
  }
}

export class AuthenticationDetectionTimeoutError extends AuthenticationDetectorError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationDetectionTimeoutError';
  }
}

export class AuthenticationDetectorUnavailableError extends AuthenticationDetectorError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationDetectorUnavailableError';
  }
}

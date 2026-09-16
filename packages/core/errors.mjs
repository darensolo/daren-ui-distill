export class DistillError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'DistillError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.subjectRef = options.subjectRef ?? null;
    this.nextAction = options.nextAction ?? 'review-input';
  }

  toJSON() {
    return {
      code: this.code,
      subjectRef: this.subjectRef,
      retryable: this.retryable,
      nextAction: this.nextAction,
      message: this.message,
    };
  }
}

export function fail(code, message, options) {
  throw new DistillError(code, message, options);
}

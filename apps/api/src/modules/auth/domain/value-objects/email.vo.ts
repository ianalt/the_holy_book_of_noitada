// Pragmatic single-line check: one "@", non-empty local part, dotted domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Value object for a verified email address. Normalizes to a trimmed, lower-cased
 * form so it is a stable identity key for cross-provider account linking (AC4).
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();
    if (!Email.isValid(normalized)) {
      throw new Error(`Invalid email address: "${value}"`);
    }
    return new Email(normalized);
  }

  static isValid(value: string): boolean {
    return EMAIL_RE.test(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

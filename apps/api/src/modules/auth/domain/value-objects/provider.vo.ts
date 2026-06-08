/** The OAuth providers this feature supports (AC1: Google, AC2: Discord). */
export type IProviderName = "google" | "discord";

const SUPPORTED_PROVIDERS: readonly IProviderName[] = ["google", "discord"];

/**
 * Value object for an OAuth provider. Rejects anything outside the supported set,
 * which backs the provider constraint behind AC1/AC2.
 */
export class Provider {
  private constructor(public readonly value: IProviderName) {}

  static create(value: string): Provider {
    if (!Provider.isSupported(value)) {
      throw new Error(`Unsupported OAuth provider: "${value}"`);
    }
    return new Provider(value);
  }

  static isSupported(value: string): value is IProviderName {
    return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
  }

  equals(other: Provider): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

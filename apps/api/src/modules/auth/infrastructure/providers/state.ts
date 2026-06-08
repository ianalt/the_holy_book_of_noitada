import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Default validity window for an issued state token (10 minutes). */
const DEFAULT_TTL_SECONDS = 600;

export interface IStateServiceConfig {
  secret: string;
  ttlSeconds?: number;
}

interface IStatePayload {
  /** Random nonce — makes each state single-use and unguessable. */
  n: string;
  /** Issued-at, epoch milliseconds. */
  t: number;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * Signed, single-use OAuth `state` for CSRF protection (AC5). The same value is
 * sent to the provider and stored in a short-lived httpOnly cookie; on callback
 * the query value must (a) equal the cookie value and (b) carry a valid, unexpired
 * HMAC signature. Single use is enforced by clearing the cookie after the callback.
 */
export class StateService {
  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(config: IStateServiceConfig) {
    if (!config.secret) {
      throw new Error("StateService requires a non-empty secret");
    }
    this.secret = config.secret;
    this.ttlMs = (config.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
  }

  /** Mints a fresh signed state token to send to the provider and store in a cookie. */
  issue(): string {
    const payload: IStatePayload = { n: randomBytes(16).toString("hex"), t: Date.now() };
    const encoded = base64url(JSON.stringify(payload));
    return `${encoded}.${this.sign(encoded)}`;
  }

  /**
   * Validates the callback state: it must match the browser's cookie value (CSRF)
   * and carry a valid, unexpired signature.
   */
  validate(queryState: string, cookieState: string): boolean {
    if (!queryState || !cookieState) {
      return false;
    }
    if (!safeEqual(queryState, cookieState)) {
      return false;
    }
    return this.verifySigned(queryState);
  }

  private verifySigned(state: string): boolean {
    const dot = state.lastIndexOf(".");
    if (dot < 0) {
      return false;
    }
    const encoded = state.slice(0, dot);
    const signature = state.slice(dot + 1);
    if (!safeEqual(signature, this.sign(encoded))) {
      return false;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as IStatePayload;
      if (typeof payload.t !== "number") {
        return false;
      }
      return Date.now() - payload.t <= this.ttlMs;
    } catch {
      return false;
    }
  }

  private sign(encoded: string): string {
    return createHmac("sha256", this.secret).update(encoded).digest("base64url");
  }
}

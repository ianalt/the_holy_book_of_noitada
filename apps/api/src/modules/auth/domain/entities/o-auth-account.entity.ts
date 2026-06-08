import type { Provider } from "../value-objects/provider.vo";

export interface IOAuthAccountProps {
  id: string;
  provider: Provider;
  providerUserId: string;
  userId: string;
  createdAt: Date;
}

/** A single provider identity (google/discord) linked to a User (AC3, AC4). */
export class OAuthAccount {
  constructor(private readonly props: IOAuthAccountProps) {}

  get id(): string {
    return this.props.id;
  }

  get provider(): Provider {
    return this.props.provider;
  }

  get providerUserId(): string {
    return this.props.providerUserId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

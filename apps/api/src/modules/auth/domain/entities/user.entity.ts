import type { Email } from "../value-objects/email.vo";

export interface IUserProps {
  id: string;
  email: Email;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregate root for an authenticated person. One User owns N OAuthAccounts and
 * is matched across providers by verified email (AC4).
 */
export class User {
  /** Role assigned on first login (AC3). */
  static readonly DEFAULT_ROLE = "member";

  constructor(private readonly props: IUserProps) {}

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get role(): string {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

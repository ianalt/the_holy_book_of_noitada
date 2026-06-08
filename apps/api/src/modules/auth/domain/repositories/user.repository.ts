import type { User } from "../entities/user.entity";
import type { Email } from "../value-objects/email.vo";

export interface ICreateUserInput {
  email: Email;
  /** Defaults to `User.DEFAULT_ROLE` ("member") when omitted (AC3). */
  role?: string;
}

/**
 * Persistence boundary for Users. Abstract here; Prisma implementation in
 * infrastructure (T-006). `findByEmail` backs cross-provider linking (AC4);
 * `create` materializes a new member on first login (AC3).
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: Email): Promise<User | null>;
  abstract create(input: ICreateUserInput): Promise<User>;
}

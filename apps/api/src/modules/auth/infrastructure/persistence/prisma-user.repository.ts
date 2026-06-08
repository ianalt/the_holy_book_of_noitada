import type { PrismaClient } from "@prisma/client";
import { User } from "../../domain/entities/user.entity";
import { type ICreateUserInput, UserRepository } from "../../domain/repositories/user.repository";
import { Email } from "../../domain/value-objects/email.vo";

interface IUserRow {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prisma implementation of UserRepository. `findByEmail` backs cross-provider
 * linking (AC4); `create` materializes a new member on first login (AC3). The
 * `email @unique` constraint guarantees no duplicate User.
 */
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? PrismaUserRepository.toEntity(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row ? PrismaUserRepository.toEntity(row) : null;
  }

  async create(input: ICreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: { email: input.email.value, role: input.role ?? User.DEFAULT_ROLE },
    });
    return PrismaUserRepository.toEntity(row);
  }

  private static toEntity(row: IUserRow): User {
    return new User({
      id: row.id,
      email: Email.create(row.email),
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

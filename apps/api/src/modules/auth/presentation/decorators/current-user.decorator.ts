import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { ICurrentUser } from "../../domain/types/current-user.type";

/**
 * Extractor backing the `@CurrentUser` decorator. Exported separately so its
 * behaviour is unit-testable without the Nest runtime.
 */
export function currentUserFactory(
  _data: unknown,
  context: ExecutionContext,
): ICurrentUser | undefined {
  return context.switchToHttp().getRequest<{ user?: ICurrentUser }>().user;
}

/**
 * Param decorator exposing the principal attached by JwtAuthGuard (AC7).
 * Usage: `@CurrentUser() user: ICurrentUser`.
 */
export const CurrentUser = createParamDecorator(currentUserFactory);

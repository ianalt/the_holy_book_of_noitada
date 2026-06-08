/**
 * The authenticated principal carried in the access token (sub + role) and
 * exposed to protected routes via the `@CurrentUser` decorator.
 */
export interface ICurrentUser {
  id: string;
  role: string;
}

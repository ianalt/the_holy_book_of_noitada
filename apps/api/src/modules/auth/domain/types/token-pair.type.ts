/** The access + refresh JWT pair issued on login and on refresh (rotation). */
export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
}

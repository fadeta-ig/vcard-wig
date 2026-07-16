export const SESSION_COOKIE_NAME = "vcard_session";
export const CSRF_COOKIE_NAME = "vcard_csrf";
export const COMPANY_COOKIE_NAME = "vcard_company";

// Read this at runtime rather than build time so the same production artifact
// can be promoted between environments with different canonical origins.
export function secureCookiesEnabled(): boolean {
  const runtimeEnvironment = process.env;
  return runtimeEnvironment.APP_URL?.startsWith("https://") ?? false;
}

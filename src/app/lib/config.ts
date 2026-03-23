function normalizeEnvValue(value: string | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

export const GOOGLE_CLIENT_ID = normalizeEnvValue(import.meta.env.VITE_GOOGLE_CLIENT_ID);
export const API_BASE_URL = normalizeEnvValue(import.meta.env.VITE_API_URL) || "http://localhost:8000";

export function hasGoogleClientId(): boolean {
  return GOOGLE_CLIENT_ID.length > 0 && GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com");
}

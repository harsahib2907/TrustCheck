const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

export function saveTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_role");
}

export function getUserRole(): string | null {
  return localStorage.getItem("user_role");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false   // prevents infinite retry loop
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  // Only set Content-Type for requests with a body
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true); // retry once with flag
    }
    clearTokens();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail ?? detail;
    } catch {
      // non-JSON error body, keep statusText
    }
    throw new Error(detail);
  }

  // Handle 204 No Content (e.g. logout)
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── Token refresh ─────────────────────────────────────────────────────────────
async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${BASE_URL}/token/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refresh}`,
        // No Content-Type — no body is sent
      },
    });

    if (!res.ok) return false;

    const data = await res.json();
    saveTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ── Public passport fetch (no auth) ──────────────────────────────────────────
export async function fetchPassport(productId: string | number) {
  const res = await fetch(`${BASE_URL}/passport/${productId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load passport");
  return res.json();
}


// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function loginWithGoogle(idToken: string, type: string) {
  const data = await apiFetch<{
    access_token: string;
    refresh_token: string;
    token_type: string;
  }>("/token", {
    method: "POST",
    body: JSON.stringify({ idToken, type }),
  });
  saveTokens(data.access_token, data.refresh_token);
  localStorage.setItem("user_role", type);
  return data;
}

export async function logout() {
  try {
    await apiFetch("/logout", { method: "POST" });
  } finally {
    clearTokens();
  }
}

export async function getMe() {
  return apiFetch<{
    id: number;
    sub: string;
    email: string;
    name: string;
    picture: string;
    type_user: string;
  }>("/users/me");
}

// ── Supplier ──────────────────────────────────────────────────────────────────
export interface LotCreate {
  material_type: string;
  certification: string;
  origin: string;
  total_qty: number;
  unit: string;
}

export async function createLot(lot: LotCreate) {
  return apiFetch<{ success: boolean; lot_id: number; lot: any }>(
    "/supplier/lots",
    { method: "POST", body: JSON.stringify(lot) }
  );
}

export async function getSupplierLots() {
  return apiFetch<any[]>("/supplier/lots");
}

// ── Manufacturer ──────────────────────────────────────────────────────────────
export interface BatchCreate {
  name: string;
  description: string;
  batch_size: number;
  expires_days: number;
  rm_lot_id: number;
  qty_used: number;
}

export async function getAvailableLots() {
  return apiFetch<any[]>("/manufacturer/lots");
}

export async function createBatch(batch: BatchCreate) {
  return apiFetch<{ qr: string; batch_id: number; item_id: number; lot_remaining_after: number }>(
    "/token/company/batch",
    { method: "POST", body: JSON.stringify(batch) }
  );
}

export async function getManufacturerBatches() {
  return apiFetch<any[]>("/manufacturer/batches");
}

// ── Distributor ───────────────────────────────────────────────────────────────
export interface ScanPayload {
  qtype: string;
  expiry: string;   // ISO datetime string
  uuid: string;
}

export async function scanAsDistributor(qr: ScanPayload, lat: number, lon: number) {
  return apiFetch<{ success: boolean; location: string; ref_id: number; type: string }>(
    `/token/distributor?lat=${lat}&lon=${lon}`,
    { method: "POST", body: JSON.stringify(qr) }
  );
}

export async function getDistributorScans() {
  return apiFetch<any[]>("/distributor/scans");
}

// ── Retailer ──────────────────────────────────────────────────────────────────
export async function scanAsRetailer(qr: ScanPayload, lat: number, lon: number) {
  return apiFetch<{ success: boolean; location: string; ref_id: number; type: string }>(
    `/token/retailer?lat=${lat}&lon=${lon}`,
    { method: "POST", body: JSON.stringify(qr) }
  );
}

export async function getRetailerScans() {
  return apiFetch<any[]>("/retailer/scans");
}

// ── Supplier scan ─────────────────────────────────────────────────────────────
export async function scanAsSupplier(
  qr: ScanPayload,
  weight: number,
  lat: number,
  lon: number
) {
  return apiFetch<{ success: boolean; location: string }>(
    `/token/supplier?weight=${weight}&lat=${lat}&lon=${lon}`,
    { method: "POST", body: JSON.stringify(qr) }
  );
}
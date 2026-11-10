import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_URL =
  (Constants.expoConfig &&
    Constants.expoConfig.extra &&
    Constants.expoConfig.extra.apiUrl) ||
  "http://192.168.1.100:4000";
let baseUrl = DEFAULT_URL;
let token = null;
let onUnauthorized = () => {};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function initApi() {
  const [url, tk] = await Promise.all([
    AsyncStorage.getItem("br_server"),
    SecureStore.getItemAsync("br_token"),
  ]);
  if (url) baseUrl = url;
  token = tk;
  return !!tk;
}
export const getServer = () => baseUrl;
export async function setServer(url) {
  baseUrl = url.replace(/\/$/, "");
  await AsyncStorage.setItem("br_server", baseUrl);
}
export async function setToken(t) {
  token = t;
  if (t) await SecureStore.setItemAsync("br_token", t);
  else await SecureStore.deleteItemAsync("br_token");
}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form)
    payload = form; // never set Content-Type by hand for multipart: fetch adds the boundary
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(baseUrl + path, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError(0, "NETWORK", "Network error");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    if (res.status === 401 && path !== "/api/auth/login") onUnauthorized();
    throw new ApiError(
      res.status,
      e.code || "SERVER_ERROR",
      e.message,
      e.details,
    );
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/api/auth/me"),
  contracts: (params = {}) =>
    request("/api/contracts?" + new URLSearchParams(params)),
  contract: (id) => request(`/api/contracts/${id}`),
  recordReturn: (id, form) =>
    request(`/api/contracts/${id}/returns`, { method: "POST", form }),
};

/** Builds the multipart body of the Condition Photo Verification endpoint. */
export function buildReturnForm({ lines, notes, signer, photos }) {
  const fd = new FormData();
  fd.append("lines", JSON.stringify(lines));
  if (notes) fd.append("notes", notes);
  if (signer) fd.append("clientSignatureName", signer);
  fd.append(
    "photoMeta",
    JSON.stringify(
      photos.map((p) => ({
        assetId: p.assetId,
        caption: p.caption,
        takenAt: p.takenAt,
      })),
    ),
  );
  photos.forEach((p, i) =>
    fd.append("photos", {
      uri: p.uri,
      name: `return-${Date.now()}-${i}.jpg`,
      type: "image/jpeg",
    }),
  );
  return fd;
}

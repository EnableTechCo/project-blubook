import type { Json } from "@/types/supabase";

export type JsonObject = { [key: string]: Json | undefined };

export function isJson(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJson);
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }

    return Object.values(value).every(
      (entry) => entry === undefined || isJson(entry),
    );
  }

  return false;
}

export function toJson(value: unknown, label = "value"): Json {
  if (!isJson(value)) {
    throw new TypeError(`${label} must be JSON-serializable.`);
  }

  return value;
}

export function asJsonObject(value: unknown): JsonObject {
  if (value === null || value === undefined) {
    return {};
  }

  const json = toJson(value);
  return json !== null && typeof json === "object" && !Array.isArray(json)
    ? json
    : {};
}

export function readJsonString(value: unknown, key: string): string | null {
  const field = asJsonObject(value)[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

export function requireJsonString(value: unknown, key: string): string {
  const field = readJsonString(value, key);
  if (!field) {
    throw new Error(`Missing ${key} in payload`);
  }

  return field;
}

export function readJsonNumber(value: unknown, key: string): number | null {
  const field = asJsonObject(value)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

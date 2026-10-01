import { readFileSync } from "node:fs";

/** A missing or malformed setting. The message names the KEY only, never the value. */
export class ConfigError extends Error {}

/**
 * The one reader of the environment. `<KEY>_FILE` points at a file holding the value (Docker/Compose secrets).
 * Parsers per capability (`parse<X>Config`) take an EnvSource and return typed options; nothing else touches process.env.
 */
export class EnvSource {
  constructor(private readonly vars: Readonly<Record<string, string | undefined>>) {}

  static fromProcess(): EnvSource {
    return new EnvSource(process.env);
  }

  private raw(key: string): string | undefined {
    const direct = this.vars[key];
    if (direct !== undefined && direct !== "") return direct;
    const file = this.vars[`${key}_FILE`];
    if (file) {
      try {
        const value = readFileSync(file, "utf8").trim();
        if (value) return value;
      } catch {
        throw new ConfigError(`${key}_FILE is set but the file cannot be read`);
      }
    }
    return undefined;
  }

  optional(key: string): string | undefined {
    return this.raw(key);
  }

  string(key: string): string {
    const value = this.raw(key);
    if (value === undefined) throw new ConfigError(`${key} is required`);
    return value;
  }

  /** A secret: required, at least `minLength` characters. */
  secret(key: string, minLength = 16): string {
    const value = this.string(key);
    if (value.length < minLength) throw new ConfigError(`${key} must be at least ${minLength} characters`);
    return value;
  }

  int(key: string, fallback: number, range: { min: number; max: number }): number {
    const value = this.raw(key);
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < range.min || n > range.max) throw new ConfigError(`${key} must be an integer between ${range.min} and ${range.max}`);
    return n;
  }

  bool(key: string, fallback: boolean): boolean {
    const value = this.raw(key);
    if (value === undefined) return fallback;
    if (/^(1|true|yes|on)$/i.test(value)) return true;
    if (/^(0|false|no|off)$/i.test(value)) return false;
    throw new ConfigError(`${key} must be a boolean (1/0)`);
  }

  /** An absolute URL with one of the given protocols; trailing slashes removed. */
  url(key: string, protocols: ReadonlyArray<string>): string {
    return this.parseUrl(key, this.string(key), protocols);
  }

  optionalUrl(key: string, protocols: ReadonlyArray<string>): string | undefined {
    const value = this.raw(key);
    return value === undefined ? undefined : this.parseUrl(key, value, protocols);
  }

  list(key: string): ReadonlyArray<string> {
    return (this.raw(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  private parseUrl(key: string, value: string, protocols: ReadonlyArray<string>): string {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ConfigError(`${key} must be an absolute URL`);
    }
    if (!protocols.includes(parsed.protocol)) throw new ConfigError(`${key} must use ${protocols.join(" or ")}`);
    return value.replace(/\/+$/, "");
  }
}

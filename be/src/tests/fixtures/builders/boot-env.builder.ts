import { EnvSource } from "@modules/platform/config"

/** A value of the right form for a key, by its name: an address, a domain, a JSON object, a 32-byte key in base64, a long secret, or a word. */
const textOf = (key: string): string => {
    if (/URL|ORIGIN|ENDPOINT|ISSUER|JWKS/.test(key)) return "https://localhost.test"
    if (/DOMAIN|HOST/.test(key)) return "localhost.test"
    if (/JSON/.test(key)) return "{}"
    if (/_KEY$/.test(key)) return `${"A".repeat(43)}=`
    if (/SECRET|TOKEN|PASSWORD|SALT|PEPPER/.test(key)) return "a".repeat(64)
    return "x"
}

/** The optional keys every deployment declares, which an app root refuses to register without. */
const DEPLOYED: ReadonlySet<string> = new Set(["PUBLIC_API_URL", "PUBLIC_SITE_URL"])

/**
 * An environment that answers every required key with a value of its form (a tunable its default, else numbers 1, flags off, durations a second, a key with a list of
 * allowed values the first of them) and declares no optional one but the public addresses every deployment has, so a boot smoke spec registers an app root as a bare deployment
 * runs it and resolves the whole module graph without reaching any service.
 */
class EveryKeyEnv extends EnvSource {
    constructor() {
        super(new Proxy({}, { get: (_target, key) => (typeof key === "string" ? textOf(key) : undefined) }))
    }

    /** No optional key but a deployment's is declared, so every optional integration stays off and only what an app requires is read. */
    override has(key: string): boolean {
        return DEPLOYED.has(key)
    }

    /** A deployment's optional key, else none. */
    override optional(key: string): string | undefined {
        return DEPLOYED.has(key) ? textOf(key) : undefined
    }

    /** A tunable's default, else 1. */
    override int(_key: string, fallback?: number): number {
        return fallback ?? 1
    }

    /** A tunable's default, else off. */
    override bool(_key: string, fallback?: boolean): boolean {
        return fallback ?? false
    }

    /** A tunable's default, else one second. */
    override duration(_key: string, fallback?: number): number {
        return fallback ?? 1000
    }

    /** The first allowed value. */
    override enum<T extends string>(_key: string, allowed: ReadonlyArray<T>): T {
        return allowed[0] as T
    }
}

/** The environment of a boot smoke spec of an app root. */
export const everyKeyEnv = (): EnvSource => new EveryKeyEnv()

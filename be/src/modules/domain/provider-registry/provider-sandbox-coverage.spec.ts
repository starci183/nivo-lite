import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

/*
 * THE SANDBOX LAW'S GATE (owner ruling R59, lane concept provider-sandbox rule 9): EVERY provider port registered on a provider registry
 * ships its sandbox implementation with its live one: `registry.register({ live, sandbox })`. The gate reads the REAL registration sites
 * of the source (every `this.<field>.register(...)` whose field is typed as a `ProviderRegistryService` subclass) and fails on a bare live
 * registration that is not on the explicit OWED list below. The list only SHRINKS: an owed site that now registers its sandbox fails the
 * gate until it is struck from the list, so nothing is ever skipped silently and a new provider cannot land without its sandbox.
 */

/** The domain folder the registrations live in. */
const DOMAIN = join(__dirname, "..")

/** Ports that are the provider's own INBOUND door (its webhook proof, read by `liveOf` before any account): there is no sandbox of them. */
const INBOUND_ONLY = new Set(["FeedWebhookRegistryService"])

/**
 * Registrations still owed a sandbox implementation, as `<folder>/<file>#<RegistryClass>` (SBX-HANDOFF lists them with their owner).
 * Strike a line in the same change that registers its sandbox.
 */
const OWED: ReadonlySet<string> = new Set<string>()

/** Every non-spec TypeScript source under a folder. */
const sourcesOf = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)
        if (statSync(path).isDirectory()) return sourcesOf(path)
        return name.endsWith(".ts") && !name.endsWith(".spec.ts") ? [path] : []
    })

/** The registry classes: every `class X extends ProviderRegistryService<...>` of the source. */
const registryClassesOf = (sources: ReadonlyArray<{ readonly text: string }>): ReadonlySet<string> =>
    new Set(sources.flatMap(({ text }) => [...text.matchAll(/class (\w+) extends ProviderRegistryService</g)].map((match) => match[1] ?? "")))

/** One registration site: the file, the registry class and whether it hands a sandbox implementation. */
interface Registration {
    readonly site: string
    readonly sandboxed: boolean
}

/** The registrations of one file: `this.<field>.register(<argument>)` on a constructor field typed as a registry class. */
const registrationsOf = (file: string, text: string, registries: ReadonlySet<string>): ReadonlyArray<Registration> => {
    const fields = new Map<string, string>()
    for (const match of text.matchAll(/private readonly (\w+): (\w+)/g)) {
        const [, field, type] = match
        if (field !== undefined && type !== undefined && registries.has(type)) fields.set(field, type)
    }
    return [...text.matchAll(/this\.(\w+)\.register\(\s*([^)]*)\)/g)].flatMap((match) => {
        const type = fields.get(match[1] ?? "")
        if (type === undefined || INBOUND_ONLY.has(type)) return []
        const argument = (match[2] ?? "").trim()
        return [{ site: `${relative(DOMAIN, file).split(sep).join("/")}#${type}`, sandboxed: argument.startsWith("{") && /\bsandbox\b/.test(argument) }]
    })
}

describe("provider sandbox law (ruling R59): every registered provider port ships its sandbox", () => {
    const sources = sourcesOf(DOMAIN).map((file) => ({ file, text: readFileSync(file, "utf8") }))
    const registries = registryClassesOf(sources)
    const registrations = sources.flatMap(({ file, text }) => registrationsOf(file, text, registries))

    it("reads the real registries and their registration sites", () => {
        expect(registries.has("DomainRegistrarRegistryService")).toBe(true)
        expect(registries.has("InvoiceIssueRegistryService")).toBe(true)
        expect(registries.has("VideoComposeRegistryService")).toBe(true)
        expect(registrations.length).toBeGreaterThanOrEqual(OWED.size)
    })

    it("refuses a live-only registration that is not on the owed list", () => {
        const unowed = registrations.filter((one) => !one.sandboxed && !OWED.has(one.site)).map((one) => one.site)
        expect(unowed).toEqual([])
    })

    it("makes the owed list shrink: a site that now registers its sandbox, or no longer exists, must leave the list", () => {
        const stillOwed = new Set(registrations.filter((one) => !one.sandboxed).map((one) => one.site))
        expect([...OWED].filter((site) => !stillOwed.has(site))).toEqual([])
    })

    it("has the first providers (iNET, Tino, MISA meInvoice) off the owed list", () => {
        const first = registrations.filter((one) => /^(inet|tino|misa-meinvoice)-provider\//.test(one.site))
        expect(first.map((one) => one.site).toSorted()).toEqual([
            "inet-provider/inet-provider-registration.service.ts#DomainRegistrarRegistryService",
            "misa-meinvoice-provider/misa-meinvoice-provider-registration.service.ts#InvoiceIssueRegistryService",
            "tino-provider/tino-provider-registration.service.ts#DomainRegistrarRegistryService",
        ])
        expect(first.every((one) => one.sandboxed)).toBe(true)
    })
})

/*
 * THE SECOND HALF OF THE LAW (R59: "every provider has a sandbox", not only those behind a registry port): every provider KIND a
 * connection can hold (the `Provider` union of `connections/connections.contracts.ts`, read from the source) ships a hardcoded sandbox
 * catalogue (an exported `SandboxCatalogue` of a `*sandbox*.catalogue.ts` file under the domain folder), so the Sandbox page can open an
 * account of it and every case is named. The kinds still owed are listed below, and the list only SHRINKS like `OWED`.
 */

/** Provider kinds with no outside system to stand in for: the account IS NIVO's own data (a file the owner uploads). */
const NO_OUTSIDE_SYSTEM: ReadonlySet<string> = new Set(["csv_import"])

/** Provider kinds still owed a sandbox catalogue (SBX-HANDOFF lists the plan of each). Strike a kind in the change that ships it. EMPTY since SBX-4: webhook, google_drive, database and telegram_user shipped theirs. */
const OWED_CATALOGUES: ReadonlySet<string> = new Set<string>()

/** The provider kinds of the `Provider` union, read from the source. */
const providerKindsOf = (text: string): ReadonlyArray<string> => {
    const union = /export type Provider =([\s\S]*?)\/\*\*/u.exec(text)?.[1] ?? ""
    return [...union.matchAll(/\|\s*"([a-z0-9_]+)"/gu)].map((match) => match[1] ?? "")
}

/** Every `*sandbox*.catalogue.ts` file under a folder. */
const cataloguesFilesOf = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)
        if (statSync(path).isDirectory()) return cataloguesFilesOf(path)
        return /sandbox.*\.catalogue\.ts$/u.test(name) ? [path] : []
    })

/** The provider keys of the exported catalogues of the files (an export with a `provider` text and a `cases` array). */
const catalogueProvidersOf = (files: ReadonlyArray<string>): ReadonlySet<string> =>
    new Set(
        files.flatMap((file) =>
            Object.values(require(file) as Record<string, unknown>).flatMap((value) => {
                if (typeof value !== "object" || value === null) return []
                const provider: unknown = Reflect.get(value, "provider")
                const cases: unknown = Reflect.get(value, "cases")
                return typeof provider === "string" && Array.isArray(cases) ? [provider] : []
            }),
        ),
    )

describe("provider sandbox law (ruling R59): every provider kind ships a sandbox catalogue", () => {
    const kinds = providerKindsOf(readFileSync(join(DOMAIN, "connections", "connections.contracts.ts"), "utf8"))
    const covered = catalogueProvidersOf(cataloguesFilesOf(DOMAIN))

    it("reads the real provider kinds and catalogues", () => {
        expect(kinds).toEqual(expect.arrayContaining(["sepay", "zalo_oa", "inet", "openapi", "imap", "smtp"]))
        expect(covered.has("sepay")).toBe(true)
    })

    it("refuses a provider kind with no catalogue that is not on the owed list", () => {
        expect(kinds.filter((kind) => !covered.has(kind) && !OWED_CATALOGUES.has(kind) && !NO_OUTSIDE_SYSTEM.has(kind))).toEqual([])
    })

    it("makes the owed list shrink: a kind that now ships its catalogue, or is no kind any more, must leave the list", () => {
        expect([...OWED_CATALOGUES].filter((kind) => covered.has(kind) || !kinds.includes(kind))).toEqual([])
    })
})

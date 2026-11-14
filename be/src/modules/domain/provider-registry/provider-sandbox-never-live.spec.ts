import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ProviderRegistryErrorCode } from "./errors/provider-registry.error"
import { ProviderRegistryService } from "./provider-registry.service"

/*
 * THE GUARD THAT A SANDBOX ACCOUNT NEVER REACHES A LIVE IMPLEMENTATION (owner rulings R56 + R59, lane concept provider-sandbox rule 2):
 * `portFor(account)` is THE ONE SWITCH. For EVERY registry of the source (every `class X extends ProviderRegistryService<...>`, found by
 * reading the sources, so a new registry is covered the day it lands) a sandbox account is answered by the sandbox port or refused, never
 * by the live instance, whatever was registered and in whatever order; and no registry overrides the switch.
 */

/** The domain folder the registries live in. */
const DOMAIN = join(__dirname, "..")

/** Every non-spec TypeScript source under a folder. */
const sourcesOf = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)
        if (statSync(path).isDirectory()) return sourcesOf(path)
        return name.endsWith(".ts") && !name.endsWith(".spec.ts") ? [path] : []
    })

/** One registry of the source: its class name, the file that declares it, and its class. */
interface RegistryClass {
    readonly name: string
    readonly file: string
    readonly ctor: new () => ProviderRegistryService<{ readonly provider: string }>
}

/** The registries: every class that extends `ProviderRegistryService`, loaded from the file that declares it. */
const registriesOf = (): ReadonlyArray<RegistryClass> =>
    sourcesOf(DOMAIN).flatMap((file) => {
        const names = [...readFileSync(file, "utf8").matchAll(/class (\w+) extends ProviderRegistryService</g)].map((match) => match[1] ?? "")
        if (names.length === 0) return []
        const loaded: Record<string, unknown> = require(file)
        return names.map((name) => ({ name, file, ctor: loaded[name] as RegistryClass["ctor"] }))
    })

/** A port double: it only carries its provider key and a label that says which implementation it is. */
const portOf = (provider: string, kind: "live" | "sandbox") => ({ provider, kind })

describe("provider sandbox is never answered by a live implementation, for every registry", () => {
    const registries = registriesOf()

    it("reads the real registries of the source (a new registry joins the guard by existing)", () => {
        const names = registries.map((one) => one.name)

        expect(registries.length).toBeGreaterThanOrEqual(20)
        expect(new Set(names).size).toBe(names.length)
        expect(names).toEqual(expect.arrayContaining(["CustomerSendRegistryService", "DomainRegistrarRegistryService", "InvoiceIssueRegistryService"]))
        expect(registries.every((one) => typeof one.ctor === "function")).toBe(true)
    })

    it.each(registries.map((one) => [one.name, one] as const))("%s: a sandbox account is answered by the sandbox port, never the live instance, whatever the registration order", (_name, { ctor }) => {
        const registry = new ctor()
        const live = portOf("p1", "live")
        const sandbox = portOf("p1", "sandbox")

        registry.register({ live, sandbox })

        expect(registry.portFor({ provider: "p1", sandbox: true })).toBe(sandbox)
        expect(registry.portFor({ provider: "p1", sandbox: true })).not.toBe(live)
        expect(registry.portFor({ provider: "p1", sandbox: false })).toBe(live)
        expect(registry.liveOf("p1")).toBe(live)

        const again = portOf("p1", "live")
        registry.register(again)
        expect(() => registry.portFor({ provider: "p1", sandbox: true })).toThrow(expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMissing }))
        expect(registry.portFor({ provider: "p1", sandbox: false })).toBe(again)
    })

    it.each(registries.map((one) => [one.name, one] as const))("%s: a provider that registered only a live port refuses a sandbox account with PROVIDER_SANDBOX_MISSING and never answers the live one", (_name, { ctor }) => {
        const registry = new ctor()
        const live = portOf("p2", "live")
        registry.register(live)

        let answered: unknown = "not asked"
        try {
            answered = registry.portFor({ provider: "p2", sandbox: true })
        } catch (cause) {
            expect(cause).toMatchObject({ code: ProviderRegistryErrorCode.SandboxMissing, params: { provider: "p2" } })
            answered = "refused"
        }

        expect(answered).toBe("refused")
        expect(registry.portFor({ provider: "p2", sandbox: false })).toBe(live)
    })

    it.each(registries.map((one) => [one.name, one] as const))("%s: a sandbox account of a provider nobody registered is refused, and a live one answers undefined", (_name, { ctor }) => {
        const registry = new ctor()

        expect(() => registry.portFor({ provider: "nobody", sandbox: true })).toThrow(expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMissing }))
        expect(registry.portFor({ provider: "nobody", sandbox: false })).toBeUndefined()
    })

    it("refuses a sandbox twin that names another provider than its live one", () => {
        const [first] = registries
        const registry = new (first as RegistryClass).ctor()

        expect(() => registry.register({ live: portOf("a", "live"), sandbox: portOf("b", "sandbox") })).toThrow(
            expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMismatch }),
        )
    })

    it("no registry overrides the one switch: portFor, liveOf and register are the base class's alone", () => {
        const overrides = registries.flatMap(({ name, ctor }) =>
            ["portFor", "liveOf", "register"].filter((member) => Object.prototype.hasOwnProperty.call(ctor.prototype, member)).map((member) => `${name}.${member}`),
        )

        expect(overrides).toEqual([])
    })
})

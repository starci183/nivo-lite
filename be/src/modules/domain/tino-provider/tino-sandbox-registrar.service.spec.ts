import * as fs from "node:fs"
import type { ConnectionRecord } from "@modules/domain/connections"
import { proofOf, registrarRefusalReason } from "@modules/domain/provider-registry"
import type { DomainRecord, DomainRenewalRequest } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { ProviderRegistryError } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { TINO_PROVIDER } from "./tino-connection-fields.policy"
import { TinoSandboxRegistrarService } from "./tino-sandbox-registrar.service"

const HELD: DomainRecord = {
    name: "Example.com",
    providerId: "200001",
    status: "Active",
    expiresOn: "2026-12-07",
    nameservers: null,
    autoRenew: true,
}
const RENEWAL: DomainRenewalRequest = { domain: HELD, years: 2 }

const build = (live = false) => {
    const account = sandboxAccount({ provider: TINO_PROVIDER })
    const { sandbox } = sandboxServiceOf(account)
    const connection: ConnectionRecord = {
        ...connectionRecord({ id: account.id, workspaceId: account.workspaceId, provider: TINO_PROVIDER }),
        ...({ sandbox: !live } as object),
    }
    return { account, sandbox, connection, registrar: new TinoSandboxRegistrarService(sandbox) }
}

const failureOf = async (work: Promise<unknown>): Promise<unknown> =>
    await work.then(
        () => null,
        (error: unknown) => error,
    )

describe("TinoSandboxRegistrarService", () => {
    it("serves the Tino provider key", () => {
        expect(build().registrar.provider).toBe(TINO_PROVIDER)
    })

    it("renews with the new end date of a fixture and logs exactly one renew call with the request", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.fixture(account, {
            operation: "renew",
            key: "example.com",
            value: { reference: "INV-1", total: 399000, providerData: { expiresOn: "2028-12-07" } },
        })

        await expect(registrar.renew(connection, RENEWAL)).resolves.toEqual({
            name: "Example.com",
            reference: "INV-1",
            total: 399000,
            providerData: { expiresOn: "2028-12-07" },
        })

        const calls = await sandbox.calls(account, "renew")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "example.com", request: RENEWAL, result: { outcome: "answered", by: "fixture" } })
    })

    it("renews by default with a deterministic receipt: the constant base plus the years", async () => {
        const { registrar, connection } = build()
        const expected = {
            name: "Example.com",
            reference: "sbx-renew-example.com-2",
            total: null,
            providerData: { sandbox: true, expiresOn: "2028-12-07" },
        }
        await expect(registrar.renew(connection, RENEWAL)).resolves.toEqual(expected)
        await expect(registrar.renew(connection, RENEWAL)).resolves.toEqual(expected)
    })

    it.each([
        ["insufficient_balance", "rejected"],
        ["domain_locked", "rejected"],
        ["already_renewed", "rejected"],
        ["rejected", "rejected"],
    ] as const)("a scripted refusal `%s` is the live rejected refusal with the word as Tino's code, one failed call", async (word, reason) => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "refused", reason: word } } })

        const error = await failureOf(registrar.renew(connection, RENEWAL))

        expect(error).toBeInstanceOf(ProviderRegistryError)
        expect(registrarRefusalReason(error)).toBe(reason)
        expect((error as ProviderRegistryError).params.providerCode).toBe(word)
        expect(proofOf(error)).toBeNull()
        const calls = await sandbox.calls(account, "renew")
        expect(calls).toHaveLength(1)
        expect(calls[0]?.result).toEqual({ outcome: "failed", failure: { kind: "refused", reason: word } })
    })

    it("maps not_found to the registrar not-found refusal", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "not_found" } } })
        expect(registrarRefusalReason(await failureOf(registrar.renew(connection, RENEWAL)))).toBe("not_found")
    })

    it("maps unavailable to the effect-unknown failure the live throws for a 5xx", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "unavailable" } } })
        const error = await failureOf(registrar.renew(connection, RENEWAL))
        expect(proofOf(error)).toBe("unknown")
        expect(registrarRefusalReason(error)).toBeNull()
    })

    it("maps timeout to the effect-unknown failure", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "timeout" } } })
        expect(proofOf(await failureOf(registrar.renew(connection, RENEWAL)))).toBe("unknown")
    })

    it("maps auth_expired to the not-sent failure the live throws on a refused token", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "auth_expired" } } })
        expect(proofOf(await failureOf(registrar.renew(connection, RENEWAL)))).toBe("not_sent")
    })

    it("finds a fixture domain by its lower-cased name and answers null when none is kept", async () => {
        const { registrar, sandbox, account, connection } = build()
        const held = { ...HELD, name: "example.com" }
        await sandbox.fixture(account, { operation: "find", key: "example.com", value: held })

        await expect(registrar.find(connection, "EXAMPLE.com")).resolves.toEqual(held)
        await expect(registrar.find(connection, "other.vn")).resolves.toBeNull()
    })

    it("refuses a fixture that does not read as a domain record with a typed error", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.fixture(account, { operation: "find", key: "bad.vn", value: { name: 1 } })
        const error = await failureOf(registrar.find(connection, "bad.vn"))
        expect(registrarRefusalReason(error)).toBe("rejected")
        expect((await sandbox.calls(account, "find"))[0]?.result).toMatchObject({ outcome: "threw" })
    })

    it("details answers its fixture, else the not-found refusal", async () => {
        const { registrar, sandbox, account, connection } = build()
        expect(registrarRefusalReason(await failureOf(registrar.details(connection, HELD)))).toBe("not_found")
        await sandbox.fixture(account, { operation: "details", key: "example.com", value: { ...HELD, nameservers: ["ns1.tino.vn"] } })
        await expect(registrar.details(connection, HELD)).resolves.toMatchObject({ nameservers: ["ns1.tino.vn"] })
    })

    it("lists the page fixture of the account, else an empty page", async () => {
        const { registrar, sandbox, account, connection } = build()
        await expect(registrar.list(connection, { page: 1, pageSize: 20 })).resolves.toEqual({ domains: [], page: 1, totalPages: null })
        await sandbox.fixture(account, { operation: "list", value: { domains: [HELD], totalPages: 3 } })
        await expect(registrar.list(connection, { page: 2, pageSize: 20 })).resolves.toEqual({ domains: [HELD], page: 2, totalPages: 3 })
    })

    it("answers availability from a fixture, else available", async () => {
        const { registrar, sandbox, account, connection } = build()
        await expect(registrar.availability(connection, "free.vn")).resolves.toEqual({ name: "free.vn", available: true, prices: [] })
        await sandbox.fixture(account, { operation: "availability", key: "taken.vn", value: { available: false } })
        await expect(registrar.availability(connection, "taken.vn")).resolves.toEqual({ name: "taken.vn", available: false, prices: [] })
    })

    it("fails a once-scripted renewal, then answers the default, one renewal per request", async () => {
        const { registrar, sandbox, account, connection } = build()
        await sandbox.script(account, {
            operation: "renew",
            script: { outcome: "fail", failure: { kind: "refused", reason: "insufficient_balance" } },
            times: 1,
        })

        expect(registrarRefusalReason(await failureOf(registrar.renew(connection, RENEWAL)))).toBe("rejected")
        await expect(registrar.renew(connection, RENEWAL)).resolves.toMatchObject({ reference: "sbx-renew-example.com-2" })
        expect((await sandbox.calls(account, "renew")).map((call) => call.result.outcome)).toEqual(["failed", "answered"])
    })

    it("answers the writes with deterministic receipts and changes, one call each", async () => {
        const { registrar, sandbox, account, connection } = build()
        await expect(registrar.register(connection, { name: "New.vn", years: 1, nameservers: [], contacts: [] })).resolves.toMatchObject({
            reference: "sbx-register-new.vn-1",
        })
        await expect(registrar.transfer(connection, { name: "Move.vn", authCode: "x", years: 1 })).resolves.toMatchObject({
            reference: "sbx-transfer-move.vn-1",
        })
        const record = { name: "@", type: "A", value: "1.2.3.4", ttl: null, priority: null }
        await expect(registrar.createDnsRecord(connection, HELD, record)).resolves.toEqual({
            name: "Example.com",
            records: null,
            providerData: { accepted: true },
        })
        await registrar.updateDnsRecord(connection, HELD, "7", record)
        await registrar.deleteDnsRecord(connection, HELD, "7")
        await registrar.updateNameservers(connection, HELD, ["ns1.tino.vn"])
        await expect(registrar.dnsRecords(connection, HELD)).resolves.toEqual({ kind: "undocumented", providerData: { records: [] } })

        expect((await sandbox.calls(account)).map((call) => call.operation)).toEqual([
            "register",
            "transfer",
            "createDnsRecord",
            "updateDnsRecord",
            "deleteDnsRecord",
            "updateNameservers",
            "dnsRecords",
        ])
    })

    it("refuses what the live adapter refuses before it sends, without a call", async () => {
        const { registrar, sandbox, account, connection } = build()
        const contact = {
            role: "registrant" as const,
            fullName: "A",
            organization: false,
            email: "a@b.vn",
            phone: "1",
            country: "VN",
            province: "HN",
            address: "x",
            ward: "y",
        }
        expect(registrarRefusalReason(await failureOf(Promise.resolve().then(() => registrar.register(connection, { name: "a.vn", years: 1, nameservers: [], contacts: [contact] }))))).toBe(
            "contacts_unsupported",
        )
        const withTtl = { name: "@", type: "A", value: "1.2.3.4", ttl: 300, priority: null }
        const refused = await failureOf(Promise.resolve().then(() => registrar.createDnsRecord(connection, HELD, withTtl)))
        expect(registrarRefusalReason(refused)).toBe("rejected")
        expect((refused as ProviderRegistryError).params.providerCode).toBe("ttl not taken")
        expect(await sandbox.calls(account)).toHaveLength(0)
    })

    it("refuses a live account in the frame", async () => {
        const { registrar, connection } = build(true)
        const error = await failureOf(registrar.renew(connection, RENEWAL))
        expect(error).toBeInstanceOf(ProviderSandboxError)
        expect((error as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)
    })

    it("never reaches a host: one constructor argument, no integration or http in its source", () => {
        expect(TinoSandboxRegistrarService.length).toBe(1)
        const source = fs.readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})

import * as fs from "node:fs"
import { proofOf, ProviderRegistryError, registrarRefusalReason } from "@modules/domain/provider-registry"
import type { DomainRecord } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode, type SandboxFailure } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { InetSandboxRegistrarService } from "./inet-sandbox-registrar.service"

const HELD: DomainRecord = {
    name: "Example.vn",
    providerId: "123456",
    status: "active",
    expiresOn: "2027-03-01",
    nameservers: null,
    autoRenew: null,
}

const build = () => {
    const account = sandboxAccount({ provider: "inet" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = { ...connectionRecord({ provider: "inet", id: account.id, workspaceId: account.workspaceId }), sandbox: true }
    return { account, sandbox, connection, registrar: new InetSandboxRegistrarService(sandbox) }
}

const failWith = (failure: SandboxFailure) => ({ outcome: "fail", failure }) as const

describe("InetSandboxRegistrarService", () => {
    it("renews from a scripted end date and logs exactly one renew call with the request", async () => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.fixture(account, { operation: "renew", key: "example.vn", value: "2029-03-01" })

        const receipt = await registrar.renew(connection, { domain: HELD, years: 2 })

        expect(receipt).toEqual({ name: "Example.vn", reference: "sbx-renew-example.vn-2", total: null, providerData: { expiresOn: "2029-03-01" } })
        const calls = await sandbox.calls(account, "renew")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "example.vn", request: { domain: HELD, years: 2 }, result: { outcome: "answered", by: "fixture" } })
    })

    it("renews by default from the domain's expiry plus the years, deterministically", async () => {
        const { connection, registrar } = build()

        const first = await registrar.renew(connection, { domain: HELD, years: 2 })
        const second = await registrar.renew(connection, { domain: HELD, years: 2 })

        expect(first.providerData).toEqual({ expiresOn: "2029-03-01" })
        expect(second).toEqual(first)
        await expect(registrar.renew(connection, { domain: { ...HELD, expiresOn: null }, years: 1 })).resolves.toMatchObject({
            providerData: { expiresOn: "2027-11-14" },
        })
    })

    it.each([
        ["insufficient_balance", "rejected"],
        ["domain_locked", "rejected"],
        ["already_renewed", "already_exists"],
        ["rejected", "rejected"],
    ] as const)("a scripted refusal %s throws the registrar refusal %s the live throws, and logs one failed call", async (reason, expected) => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.script(account, { operation: "renew", script: failWith({ kind: "refused", reason }), times: 1 })

        const error: unknown = await registrar.renew(connection, { domain: HELD, years: 1 }).catch((cause: unknown) => cause)

        expect(error).toBeInstanceOf(ProviderRegistryError)
        expect(registrarRefusalReason(error)).toBe(expected)
        expect((error as ProviderRegistryError).params).toEqual({ providerCode: reason })
        const calls = await sandbox.calls(account, "renew")
        expect(calls).toHaveLength(1)
        expect(calls[0]?.result).toEqual({ outcome: "failed", failure: { kind: "refused", reason } })
    })

    it("maps unavailable and timeout to the unknown-effect failure and auth_expired to not sent", async () => {
        const { account, sandbox, connection, registrar } = build()
        const ask = () => registrar.renew(connection, { domain: HELD, years: 1 }).catch((cause: unknown) => cause)
        await sandbox.script(account, { operation: "renew", script: failWith({ kind: "unavailable" }), times: 1 })
        expect(proofOf(await ask())).toBe("unknown")
        await sandbox.script(account, { operation: "renew", script: failWith({ kind: "timeout" }), times: 1 })
        expect(proofOf(await ask())).toBe("unknown")
        await sandbox.script(account, { operation: "renew", script: failWith({ kind: "auth_expired" }), times: 1 })
        expect(proofOf(await ask())).toBe("not_sent")
    })

    it("maps a scripted not_found to the registrar not-found refusal", async () => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.script(account, { operation: "find", script: failWith({ kind: "not_found" }), times: 1 })

        expect(registrarRefusalReason(await registrar.find(connection, "a.vn").catch((cause: unknown) => cause))).toBe("not_found")
    })

    it("finds a held domain from a fixture and answers null by default; details without a fixture are not_found", async () => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.fixture(account, { operation: "find", key: "held.vn", value: { name: "held.vn", providerId: "9", expiresOn: "2027-01-01" } })

        await expect(registrar.find(connection, "HELD.vn")).resolves.toEqual({
            name: "held.vn",
            providerId: "9",
            status: null,
            expiresOn: "2027-01-01",
            nameservers: null,
            autoRenew: null,
        })
        await expect(registrar.find(connection, "none.vn")).resolves.toBeNull()
        expect(registrarRefusalReason(await registrar.details(connection, HELD).catch((cause: unknown) => cause))).toBe("not_found")
    })

    it("throws a typed sandbox error, not a crash, for a fixture that does not parse", async () => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.fixture(account, { operation: "find", key: "bad.vn", value: { nope: true } })

        const error: unknown = await registrar.find(connection, "bad.vn").catch((cause: unknown) => cause)

        expect(error).toBeInstanceOf(ProviderSandboxError)
        expect((error as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.EntryInvalid)
        expect((await sandbox.calls(account, "find"))[0]?.result).toMatchObject({ outcome: "threw" })
    })

    it("lists a page from a fixture, and answers availability available by default", async () => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.fixture(account, { operation: "list", value: { domains: [{ name: "a.vn", providerId: "1" }], totalPages: 3 } })

        await expect(registrar.list(connection, { page: 1, pageSize: 20 })).resolves.toMatchObject({
            domains: [{ name: "a.vn", providerId: "1" }],
            page: 1,
            totalPages: 3,
        })
        await expect(registrar.availability(connection, "free.vn")).resolves.toEqual({ name: "free.vn", available: true, prices: [] })
        await sandbox.fixture(account, { operation: "availability", key: "taken.vn", value: { available: false } })
        await expect(registrar.availability(connection, "taken.vn")).resolves.toMatchObject({ available: false })
    })

    it("fails a scripted call once, then answers", async () => {
        const { account, sandbox, connection, registrar } = build()
        await sandbox.script(account, { operation: "renew", script: failWith({ kind: "refused", reason: "insufficient_balance" }), times: 1 })

        await expect(registrar.renew(connection, { domain: HELD, years: 1 })).rejects.toBeInstanceOf(ProviderRegistryError)
        await expect(registrar.renew(connection, { domain: HELD, years: 1 })).resolves.toMatchObject({ reference: "sbx-renew-example.vn-1" })
        expect((await sandbox.calls(account, "renew")).map((call) => call.result.outcome)).toEqual(["failed", "answered"])
    })

    it("takes one sandbox call per request", async () => {
        const { account, sandbox, connection, registrar } = build()
        const record = { name: "www", type: "A", value: "1.2.3.4", ttl: null, priority: null }

        await registrar.register(connection, { name: "n.vn", years: 1, nameservers: [], contacts: [] })
        await registrar.transfer(connection, { name: "t.vn", authCode: "x", years: 1 })
        await registrar.createDnsRecord(connection, HELD, record)
        await registrar.updateDnsRecord(connection, HELD, "1", record)
        await registrar.deleteDnsRecord(connection, HELD, "1")
        await registrar.updateNameservers(connection, HELD, ["ns1.a.vn"])
        await registrar.dnsRecords(connection, HELD)

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

    it("reaches no host: one constructor parameter and no integration or http in its source", () => {
        expect(InetSandboxRegistrarService.length).toBe(1)
        const source = fs.readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })

    it("refuses a live account through the frame", async () => {
        const { registrar } = build()
        const live = connectionRecord({ provider: "inet", id: "live-1" })

        const error: unknown = await registrar.availability(live, "a.vn").catch((cause: unknown) => cause)

        expect(error).toBeInstanceOf(ProviderSandboxError)
        expect((error as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)
    })
})

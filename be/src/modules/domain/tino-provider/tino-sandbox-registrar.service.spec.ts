import { readFileSync } from "node:fs"
import { proofOf, registrarRefusalReason, type DomainRecord } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { TinoSandboxRegistrarService } from "./tino-sandbox-registrar.service"
import {
    TINO_CASE,
    TINO_SANDBOX_CASES,
    TINO_SANDBOX_CATALOGUE,
    TINO_SANDBOX_DOMAINS,
    TINO_SANDBOX_RENEWAL_PRICE,
} from "./tino-sandbox.catalogue"

const build = () => {
    const account = sandboxAccount({ provider: "tino" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "tino", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, registrar: new TinoSandboxRegistrarService(sandbox) }
}

/** The record the tool would hand to renew: the name is all the sandbox reads. */
const held = (name: string): DomainRecord => ({ name, providerId: "x", status: null, expiresOn: null, nameservers: null, autoRenew: null })

/** The failure a promise rejects with (fails when it resolves). */
const failureOf = async (promise: Promise<unknown>): Promise<Error> => {
    try {
        await promise
    } catch (cause) {
        if (cause instanceof Error) return cause
    }
    throw new Error("expected a failure")
}

/** Picks the account's next case of `renew`. */
const pick = (ctx: ReturnType<typeof build>, id: string) => ctx.sandbox.setNextCase(ctx.account, "renew", id)

describe("TinoSandboxRegistrarService", () => {
    describe("the catalogue", () => {
        it("has unique ids TINO-<n>, the owner's first three, exactly one default per operation, and no inbound case", () => {
            const ids = TINO_SANDBOX_CATALOGUE.cases.map((one) => one.id)
            expect(new Set(ids).size).toBe(ids.length)
            expect(ids.every((id) => /^TINO-\d+$/.test(id))).toBe(true)
            expect(ids.slice(0, 3)).toEqual(["TINO-1", "TINO-2", "TINO-3"])
            expect(TINO_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined && one.label.length > 0)).toBe(true)
            expect(TINO_SANDBOX_CATALOGUE.cases.every((one) => one.operation === "renew")).toBe(true)
            expect(TINO_SANDBOX_CATALOGUE.cases.filter((one) => one.default === true).map((one) => one.id)).toEqual(["TINO-1"])
            expect(TINO_SANDBOX_CATALOGUE.provider).toBe("tino")
            expect(TINO_SANDBOX_CASES).toBe(TINO_SANDBOX_CATALOGUE.cases)
            expect(Object.values(TINO_CASE).toSorted()).toEqual(ids.toSorted())
        })

        it("is the same on every call (determinism)", async () => {
            const first = build()
            const second = build()
            const one = await first.registrar.renew(first.connection, { domain: held("d.vn"), years: 1 })
            const two = await second.registrar.renew(second.connection, { domain: held("d.vn"), years: 1 })
            expect(one).toEqual(two)
        })

        it("keeps a fixed list of domains no case is tied to", () => {
            expect(TINO_SANDBOX_DOMAINS.map((domain) => domain.name)).toEqual(["d.vn", "b.vn", "e.vn", "far2.vn"])
        })
    })

    describe("TINO-1: renewed (the default, nothing picked)", () => {
        it("moves the expiry by the years and answers SBX-TINO-000001 as Tino's renewal body, whatever the domain name", async () => {
            const { registrar, connection, account, sandbox } = build()
            expect((await registrar.find(connection, "D.vn"))?.expiresOn).toBe("2026-12-14")

            const receipt = await registrar.renew(connection, { domain: held("d.vn"), years: 2 })

            const total = 2 * TINO_SANDBOX_RENEWAL_PRICE
            expect(receipt).toEqual({
                name: "d.vn",
                reference: "SBX-TINO-000001",
                total,
                providerData: { invoice_id: "SBX-TINO-000001", total, expires: "2028-12-14" },
            })
            expect((await registrar.find(connection, "d.vn"))?.expiresOn).toBe("2028-12-14")
            expect((await registrar.details(connection, held("d.vn"))).expiresOn).toBe("2028-12-14")
            const calls = await sandbox.calls(account, "renew")
            expect(calls).toHaveLength(1)
            expect(calls[0]).toMatchObject({ key: "d.vn", result: { outcome: "answered" } })
            await expect(registrar.renew(connection, { domain: held("tlocked.vn"), years: 1 })).resolves.toMatchObject({ name: "tlocked.vn" })
        })

        it("a second renew moves the expiry again and takes the next reference (no idempotency of its own)", async () => {
            const { registrar, connection, sandbox, account } = build()
            await registrar.renew(connection, { domain: held("b.vn"), years: 1 })
            const second = await registrar.renew(connection, { domain: held("b.vn"), years: 1 })

            expect(second.reference).toBe("SBX-TINO-000002")
            expect((await registrar.find(connection, "b.vn"))?.expiresOn).toBe("2028-11-24")
            expect(await sandbox.calls(account, "renew")).toHaveLength(2)
        })

        it("renews from the request's record for a name the catalogue does not hold, and states no expiry when none is known", async () => {
            const { registrar, connection } = build()
            const stated = { ...held("other.vn"), expiresOn: "2027-01-05" }
            expect((await registrar.renew(connection, { domain: stated, years: 1 })).providerData).toMatchObject({ expires: "2028-01-05" })
            const bare = await registrar.renew(connection, { domain: held("none.vn"), years: 1 })
            expect(bare.providerData).not.toHaveProperty("expires")
        })

        it("picking TINO-1 again goes back to success after a failing case", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.locked)
            await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            await pick(ctx, TINO_CASE.renewed)
            await expect(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 })).resolves.toMatchObject({
                reference: "SBX-TINO-000002",
            })
        })
    })

    describe("TINO-2: insufficient balance", () => {
        it("is refused with the typed insufficient_balance every time (sticky), nothing moves", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.insufficientBalance)
            for (let round = 0; round < 2; round += 1) {
                const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
                expect(registrarRefusalReason(failure)).toBe("insufficient_balance")
                expect(failure).toMatchObject({ params: { providerCode: "insufficient_balance" } })
            }
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2026-12-14")
            const calls = await ctx.sandbox.calls(ctx.account, "renew")
            expect(calls).toHaveLength(2)
            expect(calls[0]?.result.outcome).toBe("threw")
        })
    })

    describe("TINO-3: pending, finished by the second read", () => {
        it("answers the accepted order without invoice, total or new expiry; the first read (the renewal's own proof read) still shows the old expiry, the second shows it renewed", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.pending)

            const receipt = await ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 })

            expect(receipt).toEqual({
                name: "d.vn",
                reference: "SBX-TINO-000001",
                total: null,
                providerData: { order_num: "SBX-TINO-000001", status: "pending" },
            })
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2026-12-14")
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2027-12-14")
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2027-12-14")
            expect((await ctx.registrar.list(ctx.connection, { page: 1, pageSize: 1 })).domains[0]?.expiresOn).toBe("2027-12-14")
        })

        it("is finished by the second read, whichever read it is (details, then a list), and only once", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.pending)
            await ctx.registrar.renew(ctx.connection, { domain: held("b.vn"), years: 2 })
            expect((await ctx.registrar.details(ctx.connection, held("b.vn"))).expiresOn).toBe("2026-11-24")
            await pick(ctx, TINO_CASE.renewed)
            await ctx.registrar.renew(ctx.connection, { domain: held("e.vn"), years: 1 })
            const page = await ctx.registrar.list(ctx.connection, { page: 1, pageSize: 4 })
            expect(page.domains.map((domain) => domain.expiresOn)).toEqual(["2026-12-14", "2028-11-24", "2027-11-17", "2026-12-15"])
        })
    })

    describe("the richer cases (the live errors)", () => {
        it("TINO-4 locked: refused with the typed domain_locked, nothing moves", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.locked)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("domain_locked")
            expect(failure).toMatchObject({ params: { providerCode: "domain_locked" } })
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2026-12-14")
        })

        it("TINO-5 already renewed: refused rejected (Tino has no conflict status) with domain_already_renewed", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.alreadyRenewed)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("rejected")
            expect(failure).toMatchObject({ params: { providerCode: "domain_already_renewed" } })
        })

        it("TINO-6 applied then timed out: the renew moves the expiry, then throws the unknown-outcome failure", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.appliedTimedOut)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "TINO_UNREACHABLE" })
            expect(proofOf(failure)).toBe("unknown")
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2027-12-14")
            expect((await ctx.sandbox.calls(ctx.account, "renew"))[0]?.result).toEqual({ outcome: "threw", error: "TINO_UNREACHABLE" })
        })

        it("TINO-7 flaky: a server error (unknown), nothing applied", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.flaky)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "TINO_FAILED" })
            expect(proofOf(failure)).toBe("unknown")
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2026-12-14")
        })

        it("TINO-8 unreachable: the renew times out and nothing moves", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.unreachable)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "TINO_UNREACHABLE" })
            expect(proofOf(failure)).toBe("unknown")
            expect((await ctx.registrar.find(ctx.connection, "d.vn"))?.expiresOn).toBe("2026-12-14")
        })

        it("TINO-9 auth: refused for the token at the gateway (not_sent)", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.auth)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "TINO_AUTH_FAILED" })
            expect(proofOf(failure)).toBe("not_sent")
        })

        it("TINO-10 not found: refused rejected with domain_not_held; find of a name the catalogue does not hold answers null", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.notFound)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("d.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("rejected")
            expect(failure).toMatchObject({ params: { providerCode: "domain_not_held" } })
            expect(await ctx.registrar.find(ctx.connection, "unknown.vn")).toBeNull()
        })

        it("the request's domain never picks the case: every name answers the picked case", async () => {
            const ctx = build()
            await pick(ctx, TINO_CASE.locked)
            for (const name of ["d.vn", "b.vn", "tlocked.vn", "zzz.vn"]) {
                const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held(name), years: 1 }))
                expect(failure).toMatchObject({ params: { providerCode: "domain_locked" } })
            }
            expect(await ctx.sandbox.calls(ctx.account, "renew")).toHaveLength(4)
        })
    })

    describe("the other methods", () => {
        it("lists the catalogue by pages (null page total: Tino states none)", async () => {
            const { registrar, connection } = build()
            const page = await registrar.list(connection, { page: 2, pageSize: 2 })
            expect(page.page).toBe(2)
            expect(page.totalPages).toBeNull()
            expect(page.domains.map((domain) => domain.name)).toEqual(TINO_SANDBOX_DOMAINS.slice(2, 4).map((domain) => domain.name))
        })

        it("answers availability, registration, transfer, DNS and nameserver defaults in the live shapes", async () => {
            const { registrar, connection } = build()
            expect(await registrar.availability(connection, "free.vn")).toMatchObject({ name: "free.vn", available: true })
            expect((await registrar.availability(connection, "d.vn")).available).toBe(false)
            const order = { name: "new.vn", years: 1, nameservers: [], contacts: [] }
            expect(await registrar.register(connection, order)).toMatchObject({ name: "new.vn", reference: null, total: null })
            expect(registrarRefusalReason(await failureOf(registrar.register(connection, { ...order, name: "d.vn" })))).toBe("rejected")
            expect(await registrar.dnsRecords(connection, held("d.vn"))).toMatchObject({ kind: "undocumented" })
            const input = { name: "www", type: "A", value: "1.2.3.4", ttl: null, priority: null }
            expect(await registrar.createDnsRecord(connection, held("d.vn"), input)).toMatchObject({ name: "d.vn", records: null })
            expect(registrarRefusalReason(await failureOf(registrar.createDnsRecord(connection, held("d.vn"), { ...input, ttl: 300 })))).toBe(
                "rejected",
            )
            expect(await registrar.updateNameservers(connection, held("d.vn"), ["ns.example"])).toMatchObject({ name: "d.vn" })
        })
    })

    describe("the frame", () => {
        it("refuses a live account (PROVIDER_SANDBOX_LIVE_ACCOUNT)", async () => {
            const { registrar, connection } = build()
            const live = { ...connection, sandbox: false }
            const failure = await failureOf(registrar.find(live, "d.vn"))
            expect(failure).toBeInstanceOf(ProviderSandboxError)
            expect(failure).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
            const renew = await failureOf(registrar.renew(live, { domain: held("d.vn"), years: 1 }))
            expect(renew).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        })

        it("refuses every call with the dev switch off (PROVIDER_SANDBOX_OFF)", async () => {
            const account = sandboxAccount({ provider: "tino" })
            const { sandbox } = sandboxServiceOff(account)
            const connection = connectionRecord({ provider: "tino", id: account.id, workspaceId: account.workspaceId, sandbox: true })
            const failure = await failureOf(new TinoSandboxRegistrarService(sandbox).find(connection, "d.vn"))
            expect(failure).toMatchObject({ code: ProviderSandboxErrorCode.Off })
        })
    })

    describe("zero network", () => {
        it("takes only the sandbox frame and its source reaches no integration and no transport", () => {
            const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
            expect(TinoSandboxRegistrarService.length).toBe(1)
            expect(source).not.toContain("@modules/integrations")
            expect(source).not.toContain("http")
        })
    })
})

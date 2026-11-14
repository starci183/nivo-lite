import { readFileSync } from "node:fs"
import { proofOf, registrarRefusalReason, type DomainRecord } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { InetSandboxRegistrarService } from "./inet-sandbox-registrar.service"
import {
    INET_CASE,
    INET_SANDBOX_CASES,
    INET_SANDBOX_CATALOGUE,
    INET_SANDBOX_DOMAINS,
    INET_SANDBOX_RENEWAL_PRICE,
} from "./inet-sandbox.catalogue"

const build = (family: "reseller" | "portal" = "reseller") => {
    const account = sandboxAccount({ provider: "inet" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({
        provider: "inet",
        id: account.id,
        workspaceId: account.workspaceId,
        sandbox: true,
        meta: { api_context: family },
    })
    return { account, sandbox, connection, registrar: new InetSandboxRegistrarService(sandbox) }
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

describe("InetSandboxRegistrarService", () => {
    describe("the catalogue", () => {
        it("has unique ids INET-<n>, the owner's first three, exactly one default per operation, and no inbound case", () => {
            const ids = INET_SANDBOX_CATALOGUE.cases.map((one) => one.id)
            expect(new Set(ids).size).toBe(ids.length)
            expect(ids.every((id) => /^INET-\d+$/.test(id))).toBe(true)
            expect(ids.slice(0, 3)).toEqual(["INET-1", "INET-2", "INET-3"])
            expect(INET_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined && one.label.length > 0)).toBe(true)
            expect(INET_SANDBOX_CATALOGUE.cases.every((one) => one.operation === "renew")).toBe(true)
            expect(INET_SANDBOX_CATALOGUE.cases.filter((one) => one.default === true).map((one) => one.id)).toEqual(["INET-1"])
            expect(INET_SANDBOX_CATALOGUE.provider).toBe("inet")
            expect(INET_SANDBOX_CASES).toBe(INET_SANDBOX_CATALOGUE.cases)
            expect(Object.values(INET_CASE).toSorted()).toEqual(ids.toSorted())
        })

        it("is the same on every call (determinism)", async () => {
            const first = build()
            const second = build()
            const one = await first.registrar.renew(first.connection, { domain: held("a.vn"), years: 1 })
            const two = await second.registrar.renew(second.connection, { domain: held("a.vn"), years: 1 })
            expect(one).toEqual(two)
        })

        it("keeps a fixed list of domains no case is tied to", () => {
            expect(INET_SANDBOX_DOMAINS.map((domain) => domain.name)).toEqual(["a.vn", "a2.vn", "c.vn", "far.vn"])
        })
    })

    describe("INET-1: renewed (the default, nothing picked)", () => {
        it("moves the expiry by the years and answers SBX-INET-000001, whatever the domain name", async () => {
            const { registrar, connection, account, sandbox } = build()
            expect((await registrar.find(connection, "A.vn"))?.expiresOn).toBe("2026-12-14")

            const receipt = await registrar.renew(connection, { domain: held("a.vn"), years: 2 })

            expect(receipt).toEqual({
                name: "a.vn",
                reference: "SBX-INET-000001",
                total: 2 * INET_SANDBOX_RENEWAL_PRICE,
                providerData: { sandbox: true, period: 2, expiresOn: "2028-12-14" },
            })
            expect((await registrar.find(connection, "a.vn"))?.expiresOn).toBe("2028-12-14")
            expect((await registrar.details(connection, held("a.vn"))).expiresOn).toBe("2028-12-14")
            const calls = await sandbox.calls(account, "renew")
            expect(calls).toHaveLength(1)
            expect(calls[0]).toMatchObject({ key: "a.vn", result: { outcome: "answered" } })
            await expect(registrar.renew(connection, { domain: held("locked.vn"), years: 1 })).resolves.toMatchObject({ name: "locked.vn" })
        })

        it("a second renew moves the expiry again and takes the next reference (no idempotency of its own)", async () => {
            const { registrar, connection, sandbox, account } = build()
            await registrar.renew(connection, { domain: held("a2.vn"), years: 1 })
            const second = await registrar.renew(connection, { domain: held("a2.vn"), years: 1 })

            expect(second.reference).toBe("SBX-INET-000002")
            expect((await registrar.find(connection, "a2.vn"))?.expiresOn).toBe("2028-11-24")
            expect(await sandbox.calls(account, "renew")).toHaveLength(2)
        })

        it("renews from the catalogue expiry, and from the request's record for a name the catalogue does not hold", async () => {
            const { registrar, connection } = build()
            expect((await registrar.find(connection, "c.vn"))?.expiresOn).toBe("2026-11-17")
            expect((await registrar.renew(connection, { domain: held("c.vn"), years: 3 })).providerData).toMatchObject({ expiresOn: "2029-11-17" })
            const stated = { ...held("other.vn"), expiresOn: "2027-01-05" }
            expect((await registrar.renew(connection, { domain: stated, years: 1 })).providerData).toMatchObject({ expiresOn: "2028-01-05" })
            expect((await registrar.renew(connection, { domain: held("none.vn"), years: 1 })).providerData).toEqual({ sandbox: true, period: 1 })
        })

        it("picking INET-1 again goes back to success after a failing case", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.locked)
            await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            await pick(ctx, INET_CASE.renewed)
            await expect(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 })).resolves.toMatchObject({
                reference: "SBX-INET-000002",
            })
        })
    })

    describe("INET-2: insufficient balance", () => {
        it("is refused with the typed insufficient_balance every time (sticky), nothing moves", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.insufficientBalance)
            for (let round = 0; round < 2; round += 1) {
                const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
                expect(registrarRefusalReason(failure)).toBe("insufficient_balance")
                expect(failure).toMatchObject({ params: { providerCode: "insufficient_balance" } })
            }
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2026-12-14")
            const calls = await ctx.sandbox.calls(ctx.account, "renew")
            expect(calls).toHaveLength(2)
            expect(calls[0]?.result.outcome).toBe("threw")
        })
    })

    describe("INET-3: pending, finished by the second read", () => {
        it("answers the accepted order without a new expiry; the first read (the renewal's own proof read) still shows the old expiry, the second shows it renewed", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.pending)

            const receipt = await ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 })

            expect(receipt).toEqual({
                name: "a.vn",
                reference: "SBX-INET-000001",
                total: INET_SANDBOX_RENEWAL_PRICE,
                providerData: { sandbox: true, period: 1, status: "pending" },
            })
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2026-12-14")
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2027-12-14")
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2027-12-14")
            expect((await ctx.registrar.list(ctx.connection, { page: 1, pageSize: 1 })).domains[0]?.expiresOn).toBe("2027-12-14")
        })

        it("is finished by the second read, whichever read it is (details, then a list), and only once", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.pending)
            await ctx.registrar.renew(ctx.connection, { domain: held("a2.vn"), years: 2 })
            expect((await ctx.registrar.details(ctx.connection, held("a2.vn"))).expiresOn).toBe("2026-11-24")
            await pick(ctx, INET_CASE.renewed)
            await ctx.registrar.renew(ctx.connection, { domain: held("c.vn"), years: 1 })
            const page = await ctx.registrar.list(ctx.connection, { page: 1, pageSize: 4 })
            expect(page.domains.map((domain) => domain.expiresOn)).toEqual(["2026-12-14", "2028-11-24", "2027-11-17", "2026-12-15"])
        })
    })

    describe("the richer cases (the live errors)", () => {
        it("INET-4 locked: refused with the typed domain_locked, nothing moves", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.locked)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("domain_locked")
            expect(failure).toMatchObject({ params: { providerCode: "domain_locked" } })
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2026-12-14")
        })

        it("INET-5 already renewed: refused already_exists (409)", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.alreadyRenewed)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("already_exists")
        })

        it("INET-6 applied then timed out: the renew moves the expiry, then throws the unknown-outcome failure", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.appliedTimedOut)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "INET_UNREACHABLE" })
            expect(proofOf(failure)).toBe("unknown")
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2027-12-14")
            expect((await ctx.sandbox.calls(ctx.account, "renew"))[0]?.result).toEqual({ outcome: "threw", error: "INET_UNREACHABLE" })
        })

        it("INET-7 flaky: a server error (unknown), nothing applied", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.flaky)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "INET_FAILED" })
            expect(proofOf(failure)).toBe("unknown")
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2026-12-14")
        })

        it("INET-8 unreachable: the renew times out and nothing moves", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.unreachable)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "INET_UNREACHABLE" })
            expect(proofOf(failure)).toBe("unknown")
            expect((await ctx.registrar.find(ctx.connection, "a.vn"))?.expiresOn).toBe("2026-12-14")
        })

        it("INET-9 auth: refused for the key at the gateway (not_sent)", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.auth)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "INET_AUTH_FAILED" })
            expect(proofOf(failure)).toBe("not_sent")
        })

        it("INET-10 rate: refused 429 (not_sent)", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.rate)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(failure).toMatchObject({ code: "INET_RATE_LIMITED" })
            expect(proofOf(failure)).toBe("not_sent")
        })

        it("INET-11 portal family: refused not_available on renew, by the picked case and by a portal account whatever the case", async () => {
            const ctx = build("portal")
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("not_available")
            expect(failure).toMatchObject({ params: { providerCode: "portal renewal undocumented" } })

            const reseller = build()
            await pick(reseller, INET_CASE.portal)
            const picked = await failureOf(reseller.registrar.renew(reseller.connection, { domain: held("a.vn"), years: 1 }))
            expect(registrarRefusalReason(picked)).toBe("not_available")
        })

        it("INET-12 not found: refused not_found; find of a name the catalogue does not hold answers null", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.notFound)
            const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held("a.vn"), years: 1 }))
            expect(registrarRefusalReason(failure)).toBe("not_found")
            expect(await ctx.registrar.find(ctx.connection, "unknown.vn")).toBeNull()
        })

        it("the request's domain never picks the case: every name answers the picked case", async () => {
            const ctx = build()
            await pick(ctx, INET_CASE.locked)
            for (const name of ["a.vn", "far.vn", "locked.vn", "zzz.vn"]) {
                const failure = await failureOf(ctx.registrar.renew(ctx.connection, { domain: held(name), years: 1 }))
                expect(registrarRefusalReason(failure)).toBe("domain_locked")
            }
            expect(await ctx.sandbox.calls(ctx.account, "renew")).toHaveLength(4)
        })
    })

    describe("the other methods", () => {
        it("lists the catalogue by pages and states the page total", async () => {
            const { registrar, connection } = build()
            const page = await registrar.list(connection, { page: 2, pageSize: 2 })
            expect(page.page).toBe(2)
            expect(page.totalPages).toBe(Math.ceil(INET_SANDBOX_DOMAINS.length / 2))
            expect(page.domains.map((domain) => domain.name)).toEqual(INET_SANDBOX_DOMAINS.slice(2, 4).map((domain) => domain.name))
        })

        it("answers availability, registration, transfer, DNS and nameserver defaults in the live shapes", async () => {
            const { registrar, connection } = build()
            expect(await registrar.availability(connection, "free.vn")).toEqual({ name: "free.vn", available: true, prices: [] })
            expect((await registrar.availability(connection, "a.vn")).available).toBe(false)
            const order = { name: "new.vn", years: 1, nameservers: ["ns.example"], contacts: [] }
            expect(registrarRefusalReason(await failureOf(registrar.register(connection, order)))).toBe("contacts_required")
            expect(await registrar.transfer(connection, { name: "new.vn", authCode: "x", years: 1 })).toMatchObject({ reference: "SBX-INET-000001" })
            expect(registrarRefusalReason(await failureOf(registrar.transfer(connection, { name: "a.vn", authCode: "x", years: 1 })))).toBe(
                "already_exists",
            )
            expect(await registrar.dnsRecords(connection, held("a.vn"))).toMatchObject({ kind: "undocumented" })
            const input = { name: "www", type: "A", value: "1.2.3.4", ttl: null, priority: null }
            expect(await registrar.createDnsRecord(connection, held("a.vn"), input)).toMatchObject({ name: "a.vn", records: null })
            expect(await registrar.updateNameservers(connection, held("a.vn"), ["ns.example"])).toMatchObject({ name: "a.vn" })
        })
    })

    describe("the frame", () => {
        it("refuses a live account (PROVIDER_SANDBOX_LIVE_ACCOUNT)", async () => {
            const { registrar, connection } = build()
            const live = { ...connection, sandbox: false }
            const failure = await failureOf(registrar.find(live, "a.vn"))
            expect(failure).toBeInstanceOf(ProviderSandboxError)
            expect(failure).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
            const renew = await failureOf(registrar.renew(live, { domain: held("a.vn"), years: 1 }))
            expect(renew).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        })

        it("refuses every call with the dev switch off (PROVIDER_SANDBOX_OFF)", async () => {
            const account = sandboxAccount({ provider: "inet" })
            const { sandbox } = sandboxServiceOff(account)
            const connection = connectionRecord({ provider: "inet", id: account.id, workspaceId: account.workspaceId, sandbox: true })
            const failure = await failureOf(new InetSandboxRegistrarService(sandbox).find(connection, "a.vn"))
            expect(failure).toMatchObject({ code: ProviderSandboxErrorCode.Off })
        })
    })

    describe("zero network", () => {
        it("takes only the sandbox frame and its source reaches no integration and no transport", () => {
            const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
            expect(InetSandboxRegistrarService.length).toBe(1)
            expect(source).not.toContain("@modules/integrations")
            expect(source).not.toContain("http")
        })
    })
})

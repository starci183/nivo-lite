import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import type { SandboxCallPlan, SandboxFailure } from "./provider-sandbox.contracts"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** A provider's own error, as its live implementation would throw it. */
class RegistrarRefusal extends Error {
    constructor(readonly failure: SandboxFailure) {
        super(failure.reason ?? failure.kind)
    }
}

/** A renew plan keyed by the domain: a fixture or script answer is the new end date, the default is one year after a fixed date. */
const renewPlan = (domain: string): SandboxCallPlan<{ readonly expiresAt: string }> => ({
    key: domain,
    answer: (given) => ({ expiresAt: typeof given === "string" ? given : "2027-11-14" }),
    fail: (failure) => new RegistrarRefusal(failure),
})

describe("ProviderSandboxService", () => {
    it("answers the provider's default and logs the call when nothing is scripted or kept", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)

        await expect(sandbox.call(account, "renew", { domain: "a.vn", years: 1 }, renewPlan("a.vn"))).resolves.toEqual({ expiresAt: "2027-11-14" })

        const calls = await sandbox.calls(account, "renew")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({
            operation: "renew",
            key: "a.vn",
            request: { domain: "a.vn", years: 1 },
            result: { outcome: "answered", by: "default", value: { expiresAt: "2027-11-14" } },
        })
    })

    it("answers the fixture of the exact key before the fixture of any key", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        await sandbox.fixture(account, { operation: "renew", value: "2028-01-01" })
        await sandbox.fixture(account, { operation: "renew", key: "b.vn", value: "2029-01-01" })

        await expect(sandbox.call(account, "renew", {}, renewPlan("b.vn"))).resolves.toEqual({ expiresAt: "2029-01-01" })
        await expect(sandbox.call(account, "renew", {}, renewPlan("c.vn"))).resolves.toEqual({ expiresAt: "2028-01-01" })
        expect((await sandbox.calls(account)).map((call) => call.result)).toEqual([
            { outcome: "answered", by: "fixture", value: { expiresAt: "2029-01-01" } },
            { outcome: "answered", by: "fixture", value: { expiresAt: "2028-01-01" } },
        ])
    })

    it("fails a scripted call once with the provider's own error, then answers again", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        await sandbox.script(account, {
            operation: "renew",
            script: { outcome: "fail", failure: { kind: "refused", reason: "insufficient_balance" } },
            times: 1,
        })

        const refused = sandbox.call(account, "renew", { domain: "a.vn" }, renewPlan("a.vn"))
        await expect(refused).rejects.toBeInstanceOf(RegistrarRefusal)
        await expect(refused).rejects.toMatchObject({ failure: { kind: "refused", reason: "insufficient_balance" } })
        await expect(sandbox.call(account, "renew", { domain: "a.vn" }, renewPlan("a.vn"))).resolves.toEqual({ expiresAt: "2027-11-14" })
        expect((await sandbox.calls(account, "renew")).map((call) => call.result.outcome)).toEqual(["failed", "answered"])
    })

    it("keeps a sticky script for every call and lets a scripted answer pass through the provider's reading", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        await sandbox.script(account, { operation: "renew", script: { outcome: "answer", value: "2030-05-05" } })

        await sandbox.call(account, "renew", {}, renewPlan("a.vn"))
        await expect(sandbox.call(account, "renew", {}, renewPlan("z.vn"))).resolves.toEqual({ expiresAt: "2030-05-05" })
        expect((await sandbox.calls(account)).every((call) => call.result.outcome === "answered" && call.result.by === "script")).toBe(true)
    })

    it("logs the provider's own throw and rethrows it", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        const boom = new ProviderSandboxError({ code: ProviderSandboxErrorCode.EntryInvalid, params: { why: "fixture" } })
        const plan: SandboxCallPlan<never> = { answer: () => Promise.reject(boom), fail: (failure) => new RegistrarRefusal(failure) }

        await expect(sandbox.call(account, "details", {}, plan)).rejects.toBe(boom)
        expect((await sandbox.calls(account))[0]?.result).toEqual({ outcome: "threw", error: "PROVIDER_SANDBOX_ENTRY_INVALID" })
    })

    it("refuses every door for a LIVE account and writes nothing", async () => {
        const live = sandboxAccount({ id: "live-1", sandbox: false })
        const { sandbox, store } = sandboxServiceOf(live)
        const refusal = { code: ProviderSandboxErrorCode.LiveAccount }

        await expect(sandbox.call(live, "renew", {}, renewPlan("a.vn"))).rejects.toMatchObject(refusal)
        await expect(sandbox.fixture(live, { operation: "renew", value: 1 })).rejects.toMatchObject(refusal)
        await expect(sandbox.script(live, { operation: "renew", script: { outcome: "answer", value: 1 } })).rejects.toMatchObject(refusal)
        await expect(sandbox.calls(live)).rejects.toMatchObject(refusal)
        await expect(sandbox.clearPlan(live)).rejects.toMatchObject(refusal)
        expect(store.entries).toHaveLength(0)
    })

    it("hides a removed sandbox account's fixtures, scripts and log (soft delete, R36)", async () => {
        const account = sandboxAccount()
        const { sandbox, store } = sandboxServiceOf(account)
        await sandbox.fixture(account, { operation: "renew", value: "2028-01-01" })
        await sandbox.call(account, "renew", {}, renewPlan("a.vn"))

        store.removed.add(account.id)

        expect(await sandbox.calls(account)).toEqual([])
        await expect(sandbox.call(account, "renew", {}, renewPlan("a.vn"))).resolves.toEqual({ expiresAt: "2027-11-14" })
    })

    it("refuses an unusable script or fixture", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        const invalid = { code: ProviderSandboxErrorCode.EntryInvalid }

        await expect(sandbox.fixture(account, { operation: "  ", value: 1 })).rejects.toMatchObject(invalid)
        await expect(
            sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "refused" } } }),
        ).rejects.toMatchObject(invalid)
        await expect(sandbox.script(account, { operation: "renew", script: { outcome: "answer", value: 1 }, times: 0 })).rejects.toMatchObject(invalid)
        await expect(
            sandbox.script(account, { operation: "renew", script: { outcome: "fail", failure: { kind: "explode" as "timeout" } } }),
        ).rejects.toMatchObject(invalid)
    })

    it("forgets fixtures and scripts on clear and keeps the call log", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        await sandbox.fixture(account, { operation: "renew", value: "2028-01-01" })
        await sandbox.call(account, "renew", {}, renewPlan("a.vn"))

        await sandbox.clearPlan(account)

        await expect(sandbox.call(account, "renew", {}, renewPlan("a.vn"))).resolves.toEqual({ expiresAt: "2027-11-14" })
        expect(await sandbox.calls(account)).toHaveLength(2)
    })
})

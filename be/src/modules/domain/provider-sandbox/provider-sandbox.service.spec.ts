import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import type { SandboxCallPlan } from "./provider-sandbox.contracts"
import { ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** A provider's own refusal, as its live implementation would throw it. */
class RegistrarRefusal extends Error {
    readonly code = "REGISTRAR_REJECTED"
}

/** A hardcoded catalogue of two domains: INET-1 renews (state moves), INET-2 is refused for balance. */
const EXPIRY: Readonly<Record<string, string>> = { "a.vn": "2026-12-14", "low.vn": "2026-12-01" }

const renew = (domain: string): SandboxCallPlan<{ readonly reference: string; readonly expiresOn: string }> => ({
    key: domain,
    answer: async (state) => {
        if (domain === "low.vn") throw new RegistrarRefusal("insufficient_balance")
        const kept = (await state.read("expiresOn", domain)) as string | null
        const from = kept ?? EXPIRY[domain] ?? "2026-11-14"
        const expiresOn = `${String(Number(from.slice(0, 4)) + 1)}${from.slice(4)}`
        await state.write("expiresOn", domain, expiresOn)
        return { reference: `SBX-INET-${String(state.seq + 1).padStart(6, "0")}`, expiresOn }
    },
})

describe("ProviderSandboxService", () => {
    it("answers from the hardcoded case, moves the account's state and numbers the calls, with no idempotency of its own", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)

        await expect(sandbox.call(account, "renew", { domain: "a.vn" }, renew("a.vn"))).resolves.toEqual({
            reference: "SBX-INET-000001",
            expiresOn: "2027-12-14",
        })
        await expect(sandbox.call(account, "renew", { domain: "a.vn" }, renew("a.vn"))).resolves.toEqual({
            reference: "SBX-INET-000002",
            expiresOn: "2028-12-14",
        })
        const calls = await sandbox.calls(account, "renew")
        expect(calls.map((call) => [call.key, call.request, call.result.outcome])).toEqual([
            ["a.vn", { domain: "a.vn" }, "answered"],
            ["a.vn", { domain: "a.vn" }, "answered"],
        ])
    })

    it("logs a failing case under the live error's code and rethrows it unchanged", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)

        await expect(sandbox.call(account, "renew", { domain: "low.vn" }, renew("low.vn"))).rejects.toBeInstanceOf(RegistrarRefusal)
        expect((await sandbox.calls(account))[0]?.result).toEqual({ outcome: "threw", error: "REGISTRAR_REJECTED" })
    })

    it("refuses a LIVE account at every door and keeps nothing", async () => {
        const live = sandboxAccount({ id: "live-1", sandbox: false })
        const { sandbox, store } = sandboxServiceOf(live)
        const refusal = { code: ProviderSandboxErrorCode.LiveAccount }

        await expect(sandbox.call(live, "renew", {}, renew("a.vn"))).rejects.toMatchObject(refusal)
        await expect(sandbox.calls(live)).rejects.toMatchObject(refusal)
        await expect(sandbox.reset(live)).rejects.toMatchObject(refusal)
        expect(store.entries).toHaveLength(0)
    })

    it("refuses everything when the dev switch is OFF (production), even a sandbox account", async () => {
        const account = sandboxAccount()
        const { sandbox, store } = sandboxServiceOff(account)
        const off = { code: ProviderSandboxErrorCode.Off }

        expect(sandbox.enabled()).toBe(false)
        await expect(sandbox.call(account, "renew", {}, renew("a.vn"))).rejects.toMatchObject(off)
        await expect(sandbox.calls(account)).rejects.toMatchObject(off)
        expect(store.entries).toHaveLength(0)
    })

    it("hides a removed sandbox account's state and log (soft delete, R36): it starts again from the catalogue", async () => {
        const account = sandboxAccount()
        const { sandbox, store } = sandboxServiceOf(account)
        await sandbox.call(account, "renew", {}, renew("a.vn"))

        store.removed.add(account.id)

        expect(await sandbox.calls(account)).toEqual([])
        await expect(sandbox.call(account, "renew", {}, renew("a.vn"))).resolves.toEqual({ reference: "SBX-INET-000001", expiresOn: "2027-12-14" })
    })

    it("resets the account's state and call log in one call", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        await sandbox.call(account, "renew", {}, renew("a.vn"))

        await sandbox.reset(account)

        expect(await sandbox.calls(account)).toEqual([])
        await expect(sandbox.call(account, "renew", {}, renew("a.vn"))).resolves.toEqual({ reference: "SBX-INET-000001", expiresOn: "2027-12-14" })
    })

    it("answers the account's NEXT CASE of the operation in the state (sticky until changed, R62), null while nothing is picked", async () => {
        const account = sandboxAccount()
        const { sandbox } = sandboxServiceOf(account)
        const seen: Array<string | null> = []
        const plan: SandboxCallPlan<null> = { answer: (state) => (seen.push(state.nextCase), null) }

        await sandbox.call(account, "renew", {}, plan)
        await sandbox.setNextCase(account, "renew", "INET-2")
        await sandbox.call(account, "renew", {}, plan)
        await sandbox.call(account, "renew", {}, plan)
        await sandbox.call(account, "issue", {}, plan)

        expect(seen).toEqual([null, "INET-2", "INET-2", null])
        expect(await sandbox.nextCaseOf(account, "renew")).toBe("INET-2")
        await sandbox.reset(account)
        expect(await sandbox.nextCaseOf(account, "renew")).toBeNull()
        await expect(sandbox.setNextCase({ ...account, sandbox: false }, "renew", "INET-2")).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
    })

    it("builds an inbound case's payloads from its inputs, the moment and the state, logged as ONE inbound call per send", async () => {
        const account = sandboxAccount({ provider: "sepay" })
        const { sandbox } = sandboxServiceOf(account)
        const at = new Date("2026-11-14T08:00:00.000Z")
        const inbound = {
            trigger: "t",
            path: (id: string) => `api/x/${id}`,
            inputs: [],
            eventsOf: async (input: Readonly<Record<string, string | number>>, context: { state: { seq: number }; at: Date; connectionId: string }) =>
                Promise.resolve([{ body: { ...input, id: 100 + context.state.seq, at: context.at.toISOString(), account: context.connectionId } }]),
        }

        const first = await sandbox.inbound(account, "X-1", inbound, { amount: 5 }, at)
        const second = await sandbox.inbound(account, "X-1", inbound, { amount: 6 }, at)

        expect(first).toEqual([{ body: { amount: 5, id: 100, at: at.toISOString(), account: account.id } }])
        expect(second).toEqual([{ body: { amount: 6, id: 101, at: at.toISOString(), account: account.id } }])
        expect((await sandbox.calls(account, "inbound")).map((call) => call.key)).toEqual(["X-1", "X-1"])
        await expect(sandboxServiceOff(account).sandbox.inbound(account, "X-1", inbound, {}, at)).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.Off,
        })
    })
})

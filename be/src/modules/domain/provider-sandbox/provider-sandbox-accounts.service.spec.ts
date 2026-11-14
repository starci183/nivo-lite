import { mock } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"
import type { SandboxInput } from "./provider-sandbox.contracts"
import { ProviderSandboxAccountsService } from "./provider-sandbox-accounts.service"
import { SandboxCatalogueRegistryService } from "./sandbox-catalogue-registry.service"
import { SANDBOX_KEY_HEADER } from "./sandbox-webhook-key.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", provider: "sepay", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", provider: "sepay" })
const NOW = new Date("2026-11-14T08:00:00.000Z")

/** The doors over a connections double holding one sandbox and one live account, the frame switched as asked, a small catalogue. */
const doorsOf = (enabled: boolean) => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.create.mockResolvedValue(SANDBOX.id)
    connections.list.mockResolvedValue([SANDBOX, LIVE])
    connections.find.mockImplementation((_ws, id) => Promise.resolve([SANDBOX, LIVE].find((one) => one.id === id) ?? null))
    connections.sandboxKeyOf.mockImplementation((_ws, id) => Promise.resolve(id === SANDBOX.id ? "sbx_key" : null))
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register({
        provider: "sepay",
        prefill: {
            operation: "transfer",
            inputOf: (request) => (request as { content: string; amountVnd: number } | null)?.content === undefined
                ? null
                : { content: (request as { content: string }).content, amount: (request as { amountVnd: number }).amountVnd },
        },
        cases: [
            {
                id: "BANK-1",
                label: "money in, posted twice",
                inbound: {
                    trigger: "transaction.received",
                    path: (id) => `api/connections/sepay/${id}`,
                    inputs: [
                        { name: "content", label: "content", kind: "text", example: "EX" },
                        { name: "amount", label: "amount", kind: "integer", example: 1 },
                    ],
                    eventsOf: (input: SandboxInput, context) =>
                        Promise.resolve([
                            { body: { ...input, n: context.state.seq, at: context.at.toISOString() } },
                            { body: { ...input, n: context.state.seq, at: context.at.toISOString() }, headers: { "x-extra": "1" } },
                        ]),
                },
            },
            { id: "BANK-2", label: "renewed", operation: "renew", default: true },
            { id: "BANK-3", label: "refused", operation: "renew" },
        ],
    })
    const { sandbox } = (enabled ? sandboxServiceOf : sandboxServiceOff)(SANDBOX, LIVE)
    const poster = new RecordingWebhookPoster()
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    return { connections, doors, poster, sandbox }
}

describe("ProviderSandboxAccountsService (the Sandbox page's doors, rulings R58, R60, R62)", () => {
    it("opens a sandbox account through the normal create path with no credential, and answers its key", async () => {
        const { doors, connections } = doorsOf(true)
        await expect(doors.open(ACTOR, { provider: "sepay", name: "SePay sandbox" })).resolves.toEqual({ id: SANDBOX.id, sandboxKey: "sbx_key" })
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner", "manager"])
        expect(connections.create).toHaveBeenCalledWith(expect.objectContaining({ sandbox: true, status: "connected", meta: {} }))
        expect(connections.create.mock.calls[0]?.[0]).not.toHaveProperty("secret")
    })

    it("opens only a provider that ships a sandbox (a catalogue): any other key is refused before anything is written", async () => {
        const { doors, connections } = doorsOf(true)
        await expect(doors.open(ACTOR, { provider: "telegram", name: "x" })).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.ProviderUnknown,
            params: { provider: "telegram" },
        })
        await expect(doors.open(ACTOR, { provider: "nope", name: "x" })).rejects.toMatchObject({ code: ProviderSandboxErrorCode.ProviderUnknown })
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("lists only the workspace's sandbox accounts, the providers with a catalogue and a provider's catalogue", async () => {
        const { doors } = doorsOf(true)
        expect((await doors.accounts(ACTOR)).map((one) => one.id)).toEqual([SANDBOX.id])
        expect(await doors.providers(ACTOR)).toEqual(["sepay"])
        expect((await doors.catalogue(ACTOR, "sepay")).map((one) => one.id)).toEqual(["BANK-1", "BANK-2", "BANK-3"])
    })

    it("SENDS an inbound case: the case's payloads, in order, to the provider's own route with the sandbox key; logs one inbound call", async () => {
        const { doors, poster, sandbox } = doorsOf(true)

        const sent = await doors.send(ACTOR, SANDBOX.id, "BANK-1", { content: "NIVO DH1", amount: 350000 })

        const path = `api/connections/sepay/${SANDBOX.id}`
        expect(poster.posts).toEqual([
            { path, body: { content: "NIVO DH1", amount: 350000, n: 0, at: NOW.toISOString() }, headers: { [SANDBOX_KEY_HEADER]: "sbx_key" } },
            {
                path,
                body: { content: "NIVO DH1", amount: 350000, n: 0, at: NOW.toISOString() },
                headers: { "x-extra": "1", [SANDBOX_KEY_HEADER]: "sbx_key" },
            },
        ])
        expect(sent).toEqual({
            caseId: "BANK-1",
            input: { content: "NIVO DH1", amount: 350000 },
            deliveries: [
                { path, status: 200, body: { success: true } },
                { path, status: 200, body: { success: true } },
            ],
        })
        const calls = await sandbox.calls(SANDBOX, "inbound")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "BANK-1", request: { caseId: "BANK-1", input: { content: "NIVO DH1", amount: 350000 } } })
    })

    it("prefills the inputs from the LATEST payment request the agent made, else the examples; refuses a wrong kind", async () => {
        const { doors, poster, sandbox } = doorsOf(true)

        expect(await doors.latestRequest(ACTOR, SANDBOX.id)).toBeNull()
        await doors.send(ACTOR, SANDBOX.id, "BANK-1")
        expect(poster.posts[0]?.body).toMatchObject({ content: "EX", amount: 1 })

        await sandbox.call(SANDBOX, "transfer", { content: "OLD", amountVnd: 10 }, { answer: () => ({}) })
        await sandbox.call(SANDBOX, "transfer", { content: "NIVO DH7", amountVnd: 70000 }, { answer: () => ({}) })
        await expect(doors.latestRequest(ACTOR, SANDBOX.id)).resolves.toMatchObject({
            operation: "transfer",
            input: { content: "NIVO DH7", amount: 70000 },
        })
        await expect(doors.send(ACTOR, SANDBOX.id, "BANK-1", { amount: 69000 })).resolves.toMatchObject({
            input: { content: "NIVO DH7", amount: 69000 },
        })
        await expect(doors.send(ACTOR, SANDBOX.id, "BANK-1", { amount: "x" })).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.InputInvalid,
            params: { field: "amount" },
        })
    })

    it("refuses to send an outbound or unknown case", async () => {
        const { doors } = doorsOf(true)
        await expect(doors.send(ACTOR, SANDBOX.id, "BANK-2")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.CaseUnknown })
        await expect(doors.send(ACTOR, SANDBOX.id, "BANK-9")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.CaseUnknown })
    })

    it("answers the default (success) next case until one is picked, and keeps a pick (sticky) until changed", async () => {
        const { doors, sandbox } = doorsOf(true)

        expect(await doors.nextCases(ACTOR, SANDBOX.id)).toEqual([{ operation: "renew", caseId: "BANK-2", isDefault: true }])
        await expect(doors.setNextCase(ACTOR, SANDBOX.id, "BANK-3")).resolves.toEqual({ operation: "renew", caseId: "BANK-3", isDefault: false })
        expect(await doors.nextCases(ACTOR, SANDBOX.id)).toEqual([{ operation: "renew", caseId: "BANK-3", isDefault: false }])
        const seen: Array<string | null> = []
        for (const _ of [1, 2]) await sandbox.call(SANDBOX, "renew", {}, { answer: (state) => seen.push(state.nextCase) })
        expect(seen).toEqual(["BANK-3", "BANK-3"])
        await expect(doors.setNextCase(ACTOR, SANDBOX.id, "BANK-1")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.CaseUnknown })
    })

    it("refuses a live or unknown account at the account doors", async () => {
        const { doors } = doorsOf(true)
        await expect(doors.calls(ACTOR, LIVE.id)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(doors.send(ACTOR, LIVE.id, "BANK-1")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(doors.sandboxKey(ACTOR, "33333333-3333-4333-8333-333333333333")).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.AccountNotFound,
        })
    })

    it("answers one sandbox account for the attach doors, refusing a live, unknown or (switch off) any account", async () => {
        const { doors } = doorsOf(true)
        await expect(doors.account(ACTOR, SANDBOX.id)).resolves.toMatchObject({ id: SANDBOX.id, provider: "sepay", sandbox: true })
        await expect(doors.account(ACTOR, LIVE.id)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(doors.account(ACTOR, "33333333-3333-4333-8333-333333333333")).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.AccountNotFound,
        })
        await expect(doorsOf(false).doors.account(ACTOR, SANDBOX.id)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("discards a sandbox account it opened (the take-back of a half-made open) and never a live one", async () => {
        const { doors, connections } = doorsOf(true)
        await doors.discard(ACTOR, SANDBOX.id)
        expect(connections.remove).toHaveBeenCalledWith("ws-1", SANDBOX.id)
        connections.remove.mockClear()
        await expect(doors.discard(ACTOR, LIVE.id)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        expect(connections.remove).not.toHaveBeenCalled()
    })

    it("is closed when the dev switch is OFF: says so, opens nothing, sends nothing", async () => {
        const { doors, connections, poster } = doorsOf(false)
        const off = { code: ProviderSandboxErrorCode.Off }
        expect(doors.enabled()).toBe(false)
        await expect(doors.open(ACTOR, { provider: "sepay", name: "SePay sandbox" })).rejects.toMatchObject(off)
        await expect(doors.accounts(ACTOR)).rejects.toMatchObject(off)
        await expect(doors.send(ACTOR, SANDBOX.id, "BANK-1")).rejects.toMatchObject(off)
        await expect(doors.setNextCase(ACTOR, SANDBOX.id, "BANK-3")).rejects.toMatchObject(off)
        expect(connections.create).not.toHaveBeenCalled()
        expect(poster.posts).toEqual([])
    })
})

import { mock } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import { MemoryProviderSandboxStore, sandboxAccount } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"
import { SandboxWebhookKeyService } from "./sandbox-webhook-key.service"

/** The guard over a store that knows these accounts, the switch, and a connections double whose only right key is `good-key`. */
const guardOf = (enabled: boolean, ...accounts: ReadonlyArray<ReturnType<typeof sandboxAccount>>) => {
    const store = new MemoryProviderSandboxStore()
    for (const account of accounts) store.open(account)
    const connections = mock<ConnectionsService>()
    connections.isSandboxKey.mockImplementation((_id, presented) => presented === "good-key")
    return { store, connections, guard: new SandboxWebhookKeyService(store, { enabled }, connections) }
}

describe("SandboxWebhookKeyService (rulings R58 + R60: the one shared guard of a provider webhook)", () => {
    const sandbox = sandboxAccount({ id: "11111111-1111-4111-8111-111111111111", provider: "zalo_oa" })
    const live = sandboxAccount({ id: "22222222-2222-4222-8222-222222222222", provider: "zalo_oa", sandbox: false })

    it("answers live for a LIVE account whatever the header says, so its provider's own proof runs untouched", async () => {
        const { guard, connections } = guardOf(true, live)
        await expect(guard.verdictOf("22222222-2222-4222-8222-222222222222", undefined)).resolves.toEqual({ kind: "live" })
        await expect(guard.verdictOf("22222222-2222-4222-8222-222222222222", "good-key")).resolves.toEqual({ kind: "live" })
        expect(connections.isSandboxKey).not.toHaveBeenCalled()
    })

    it("answers live for a scope that is no connection id (an app-level route) without reading anything", async () => {
        const { guard, connections } = guardOf(true, sandbox)
        await expect(guard.verdictOf("webhook", "good-key")).resolves.toEqual({ kind: "live" })
        expect(connections.isSandboxKey).not.toHaveBeenCalled()
    })

    it("answers live for a removed or unknown account, so the door's own not-found holds", async () => {
        const { guard, store } = guardOf(true, sandbox)
        store.removed.add("11111111-1111-4111-8111-111111111111")
        await expect(guard.verdictOf("11111111-1111-4111-8111-111111111111", "good-key")).resolves.toEqual({ kind: "live" })
        await expect(guard.verdictOf("33333333-3333-4333-8333-333333333333", "good-key")).resolves.toEqual({ kind: "live" })
    })

    it("proves a sandbox account by its own sandbox key", async () => {
        const { guard, connections } = guardOf(true, sandbox)
        await expect(guard.verdictOf("11111111-1111-4111-8111-111111111111", "good-key")).resolves.toEqual({ kind: "sandbox", workspaceId: "ws-1", provider: "zalo_oa" })
        expect(connections.isSandboxKey).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "good-key")
    })

    it("refuses a sandbox account's call with no key or a wrong key (never open to the world)", async () => {
        const { guard } = guardOf(true, sandbox)
        const refused = { code: ProviderSandboxErrorCode.WebhookKeyRefused }
        await expect(guard.verdictOf("11111111-1111-4111-8111-111111111111", undefined)).rejects.toMatchObject(refused)
        await expect(guard.verdictOf("11111111-1111-4111-8111-111111111111", "wrong")).rejects.toMatchObject(refused)
    })

    it("takes no sandbox key at all while the sandbox is switched off", async () => {
        const { guard } = guardOf(false, sandbox, live)
        await expect(guard.verdictOf("11111111-1111-4111-8111-111111111111", "good-key")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        await expect(guard.verdictOf("22222222-2222-4222-8222-222222222222", "good-key")).resolves.toEqual({ kind: "live" })
    })
})

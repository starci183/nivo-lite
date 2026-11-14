import type { EntityManager } from "typeorm"
import { sha256 } from "@modules/domain/connections"
import { ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"
import { SandboxWebhookKeyService, issueSandboxKey } from "./sandbox-webhook-key.service"

/** A primary manager whose one select answers `row` (undefined: no such live connection). */
const managerAnswering = (row: object | undefined): EntityManager => {
    const query = {
        select: () => query,
        addSelect: () => query,
        where: () => query,
        limit: () => query,
        getRawOne: () => Promise.resolve(row),
    }
    return { createQueryBuilder: () => query } as unknown as EntityManager
}

describe("SandboxWebhookKeyService", () => {
    const key = issueSandboxKey()
    const sandboxRow = { workspaceId: "ws-1", provider: "zalo_oa", sandbox: true, keySha256: key.sha256 }

    it("issues a fresh key whose stored form is only its SHA-256", () => {
        const other = issueSandboxKey()
        expect(key.plain).toMatch(/^sbx_[A-Za-z0-9_-]{43}$/)
        expect(key.sha256).toBe(sha256(key.plain))
        expect(other.plain).not.toBe(key.plain)
    })

    it("answers live for a LIVE account whatever the header says, so its provider's own proof runs untouched", async () => {
        const guard = new SandboxWebhookKeyService(managerAnswering({ ...sandboxRow, sandbox: false, keySha256: null }))
        await expect(guard.verdictOf("c-1", undefined)).resolves.toEqual({ kind: "live" })
        await expect(guard.verdictOf("c-1", key.plain)).resolves.toEqual({ kind: "live" })
    })

    it("answers live for a removed or unknown account, so the door's own not-found holds", async () => {
        await expect(new SandboxWebhookKeyService(managerAnswering(undefined)).verdictOf("c-gone", key.plain)).resolves.toEqual({ kind: "live" })
    })

    it("proves a sandbox account by its own key", async () => {
        const guard = new SandboxWebhookKeyService(managerAnswering(sandboxRow))
        await expect(guard.verdictOf("c-1", key.plain)).resolves.toEqual({ kind: "sandbox", workspaceId: "ws-1", provider: "zalo_oa" })
    })

    it("refuses a sandbox account's call with no key, a wrong key or no stored key", async () => {
        const refused = { code: ProviderSandboxErrorCode.WebhookKeyRefused }
        const guard = new SandboxWebhookKeyService(managerAnswering(sandboxRow))
        await expect(guard.verdictOf("c-1", undefined)).rejects.toMatchObject(refused)
        await expect(guard.verdictOf("c-1", "")).rejects.toMatchObject(refused)
        await expect(guard.verdictOf("c-1", issueSandboxKey().plain)).rejects.toMatchObject(refused)
        await expect(new SandboxWebhookKeyService(managerAnswering({ ...sandboxRow, keySha256: null })).verdictOf("c-1", key.plain)).rejects.toMatchObject(refused)
    })
})

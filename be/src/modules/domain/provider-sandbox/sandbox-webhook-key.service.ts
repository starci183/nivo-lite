import { randomBytes, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { connectionsEntities, sha256 } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** The connections entity (the capability exports its entity list only). */
const [ConnectionEntity] = connectionsEntities

/** The header a webhook call for a sandbox account carries its key in (ruling R58). */
export const SANDBOX_KEY_HEADER = "x-nivo-sandbox-key"

/** A sandbox key issued with a new sandbox account: the plain key is shown ONCE, only its SHA-256 is kept. */
export interface IssuedSandboxKey {
    readonly plain: string
    readonly sha256: string
}

/** What the guard concluded for one webhook call: the account is live (its provider's own proof runs, untouched) or a proven sandbox one. */
export type SandboxWebhookVerdict = { readonly kind: "live" } | { readonly kind: "sandbox"; readonly workspaceId: string; readonly provider: string }

/** Equal hex digests, compared in constant time. */
const sameDigest = (left: string, right: string): boolean => {
    const a = Buffer.from(left, "utf8")
    const b = Buffer.from(right, "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}

/** A fresh sandbox key: 32 random bytes, url-safe. */
export const issueSandboxKey = (): IssuedSandboxKey => {
    const plain = `sbx_${randomBytes(32).toString("base64url")}`
    return { plain, sha256: sha256(plain) }
}

@Injectable()
/**
 * THE ONE SHARED GUARD of a provider webhook for a sandbox account (ruling R58: a sandbox account keeps the provider's OWN webhook route;
 * only its verification differs). Every provider webhook door asks it first, with the connection id its route names and the
 * `x-nivo-sandbox-key` header: a LIVE account answers `live` and the door runs its provider's own signature proof exactly as before (this
 * guard never weakens it); a SANDBOX account must present the key issued with it (only its SHA-256 is stored), else the call is refused
 * `PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED`, and on a match the door skips the provider proof (the account holds no provider secret) and goes
 * on through its same intake → translate → deliver. A removed or unknown account answers `live`, so the door's own not-found holds.
 */
export class SandboxWebhookKeyService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The verdict of one webhook call for the connection its route names. */
    async verdictOf(connectionId: string, presented: string | undefined, manager: EntityManager = this.entityManager): Promise<SandboxWebhookVerdict> {
        const row = await manager
            .createQueryBuilder(ConnectionEntity, "c")
            .select("c.workspace_id", "workspaceId")
            .addSelect("c.provider", "provider")
            .addSelect("c.sandbox", "sandbox")
            .addSelect("c.sandbox_key_sha256", "keySha256")
            .where("c.id = :connectionId", { connectionId })
            .limit(1)
            .getRawOne<{ workspaceId: string; provider: string; sandbox: boolean; keySha256: string | null }>()
        if (row?.sandbox !== true) return { kind: "live" }
        if (presented === undefined || presented.length === 0 || row.keySha256 === null || !sameDigest(sha256(presented), row.keySha256)) {
            throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.WebhookKeyRefused, params: { connectionId } })
        }
        return { kind: "sandbox", workspaceId: row.workspaceId, provider: row.provider }
    }
}

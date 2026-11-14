import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { metaPageSecretOf } from "./meta-page-secret.policy"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import type { MetaPublishingAccess } from "@modules/integrations/meta-publishing"
import { META_PROVIDER } from "./meta-publishing-failure.policy"

/** The public fact of a Meta connection naming the linked Instagram account (the Meta connection wizard stores it as `ig_id`). */
export const META_IG_ID = "ig_id"

@Injectable()
/**
 * The Page access of one Meta account, opened from its sealed secret (`{ pageId, pageToken }`, the shape the Meta connection holds once a
 * Page is chosen); an account of another provider or without a chosen Page sends nothing.
 */
export class MetaPublishingCredentialService {
    constructor(private readonly connections: ConnectionsService) {}

    /** The account's Page access; `no_credential` (proved `not_sent`) when it has none or is no Meta account. */
    async accessOf(connection: ConnectionRecord): Promise<MetaPublishingAccess> {
        const provider: string = connection.provider
        const sealed = provider === META_PROVIDER ? await this.connections.readSecret(connection.id) : null
        const secret = sealed === null ? {} : metaPageSecretOf(sealed.plain)
        if (secret.pageId === undefined || secret.pageToken === undefined) {
            throw withProof(providerRefusal(META_PROVIDER, "no_credential"), "not_sent")
        }
        const igId = connection.meta[META_IG_ID]
        return { token: secret.pageToken, pageId: secret.pageId, igId: igId === undefined || igId === "" ? null : igId }
    }

    /** The access of an account that must reach Instagram: `no_credential` when no Instagram account is linked to the Page. */
    async instagramAccessOf(connection: ConnectionRecord): Promise<MetaPublishingAccess & { readonly igId: string }> {
        const access = await this.accessOf(connection)
        if (access.igId === null) throw withProof(providerRefusal(META_PROVIDER, "no_credential", "no Instagram account linked"), "not_sent")
        return { ...access, igId: access.igId }
    }
}

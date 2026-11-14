import { Injectable } from "@nestjs/common"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type FacebookPostRequest,
    type FacebookPostResult,
    type FacebookPublishPort,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { FACEBOOK_SANDBOX_PAGE_ID, FACEBOOK_SANDBOX_POSTS } from "./meta-facebook-sandbox.catalogue"

/** The sandbox operation word of one Page post. */
const PUBLISH_OPERATION = "publish"

/** The running number of a reference: six digits. */
const numberOf = (seq: number): string => String(seq + 1).padStart(6, "0")

@Injectable()
/**
 * Meta's SANDBOX implementation of the Facebook destination (`FacebookPublishPort`; owner rulings R56, R59, R60): used when the Meta
 * account is a sandbox account. It answers through the generic sandbox frame from the hardcoded `FACEBOOK-<n>` catalogue and never
 * reaches a host. A post is picked by its exact message (the natural key); a message the catalogue does not name is accepted. A post with
 * no message, link or media is refused `rejected` before anything is sent, as the live twin refuses it. The refusals throw exactly the
 * live refusals (`providerRefusal` proving `not_sent`). Post ids run `<page id>_<n>` by the calls the account took (`state.seq`). The
 * sandbox adds no idempotency: a second call posts again.
 */
export class MetaFacebookSandboxPublishService implements FacebookPublishPort {
    /** The provider key. */
    readonly provider: string = PROVIDER.meta

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Publishes one post to the Page of a sandbox account through exactly one sandbox call keyed by the message (else the link). */
    async publish(connection: ConnectionRecord, request: FacebookPostRequest): Promise<FacebookPostResult> {
        const { message, link, media } = request
        return await this.sandbox.call(connection, PUBLISH_OPERATION, request, {
            key: message ?? link ?? "",
            answer: (state) => {
                if (message === null && link === null && media === null) {
                    throw withProof(providerRefusal(this.provider, "rejected", "message, link or media"), "not_sent")
                }
                const named = message === null ? undefined : FACEBOOK_SANDBOX_POSTS[message]
                if (named?.outcome.kind === "refused") {
                    throw withProof(providerRefusal(this.provider, named.outcome.reason, named.outcome.detail), "not_sent")
                }
                const postId = `${FACEBOOK_SANDBOX_PAGE_ID}_${numberOf(state.seq)}`
                if (media === null) return { kind: link === null ? "text" : "link", postId, mediaId: null }
                if (media.kind === "photo") return { kind: "photo", postId, mediaId: `sbx-photo-${numberOf(state.seq)}` }
                return { kind: "video", postId: null, mediaId: `sbx-video-${numberOf(state.seq)}` }
            },
        })
    }
}

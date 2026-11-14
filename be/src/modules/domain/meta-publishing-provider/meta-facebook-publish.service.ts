import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type FacebookPostRequest,
    type FacebookPostResult,
    type FacebookPublishPort,
} from "@modules/domain/provider-registry"
import { InjectMetaPublishing, type MetaPublishingClient } from "@modules/integrations/meta-publishing"
import { MetaPublishingCredentialService } from "./meta-publishing-credential.service"
import { META_PROVIDER, metaPublishingFailureOf } from "./meta-publishing-failure.policy"
import { DomainError } from "@modules/platform/errors"

@Injectable()
/**
 * Meta as the adapter of the Facebook destination (`FacebookPublishPort`): a text or link post is the Page feed edge, a photo the Page
 * photos edge, a video the Page videos edge, all on the Page the account holds a token for. A post with no message, link or media is
 * refused `rejected` before anything is sent (the feed edge: "You must provide `link` or `message`").
 */
export class MetaFacebookPublishService implements FacebookPublishPort {
    /** The provider key. */
    readonly provider: string = META_PROVIDER

    constructor(
        @InjectMetaPublishing() private readonly client: MetaPublishingClient,
        private readonly credentials: MetaPublishingCredentialService,
    ) {}

    /** Publishes one post to the Page. */
    async publish(connection: ConnectionRecord, request: FacebookPostRequest): Promise<FacebookPostResult> {
        const { message, link, media } = request
        if (message === null && link === null && media === null) {
            throw withProof(providerRefusal(this.provider, "rejected", "message, link or media"), "not_sent")
        }
        const access = await this.credentials.accessOf(connection)
        try {
            if (media === null) {
                const post = await this.client.postFeed(access, { message, link })
                return { kind: link === null ? "text" : "link", postId: post.id, mediaId: null }
            }
            if (media.kind === "photo") {
                const photo = await this.client.postPhoto(access, { url: media.url, caption: message })
                return { kind: "photo", postId: photo.postId, mediaId: photo.id }
            }
            const video = await this.client.postVideo(access, { fileUrl: media.url, description: message, title: media.title })
            return { kind: "video", postId: null, mediaId: video.id }
        } catch (cause) {
            const failure = metaPublishingFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}

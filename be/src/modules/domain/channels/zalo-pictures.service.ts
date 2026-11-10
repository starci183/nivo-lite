import { Injectable } from "@nestjs/common"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { zaloFailureOf } from "@modules/integrations/zalo"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelCollageService } from "./channel-collage.service"
import type { ChannelImage } from "./channel-image.contracts"
import { imageRouteOf } from "./channel-image.policy"
import { ChannelsLogEvent } from "./channels.log-events"
import { COLLAGE_MAX } from "./collage.policy"

/** Sends one picture to the customer by its public address; rejects when Zalo refuses it. */
export type ZaloPictureSender = (imageUrl: string) => Promise<void>

@Injectable()
/**
 * The pictures of a Zalo reply that follow its text. Several go as ONE collage image (up to six photos, the name and price under each) when a
 * collage can be built and Zalo takes it; otherwise, and for the photos beyond the sixth, they go one by one in order. A refusal stops the
 * rest and is only logged: the text already reached the customer.
 */
export class ZaloPicturesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly collage: ChannelCollageService,
    ) {}

    /** Sends the pictures through `sendOne`, the way the route of the channel says; never throws. */
    async send(
        target: ChatConversationTarget,
        images: ReadonlyArray<ChannelImage>,
        sendOne: ZaloPictureSender,
    ): Promise<void> {
        try {
            const route = imageRouteOf("zalo", images.length, this.collage.canBuild())
            const collaged = route === "collage" && (await this.sendCollage(target, images, sendOne))
            await eachInOrder(collaged ? images.slice(COLLAGE_MAX) : images, (image) => sendOne(image.url))
        } catch (cause) {
            this.logger.warn(ChannelsLogEvent.ImageFailed, { conversationId: target.id, failure: zaloFailureOf(cause) })
        }
    }

    /** Sends the collage of the pictures as one image; false when it could not be built or Zalo refused it, so the pictures go one by one. */
    private async sendCollage(
        target: ChatConversationTarget,
        images: ReadonlyArray<ChannelImage>,
        sendOne: ZaloPictureSender,
    ): Promise<boolean> {
        const url = await this.collage.urlOf(images)
        if (url === null) return false
        return sendOne(url).then(
            () => true,
            (cause: unknown) => {
                this.logger.warn(ChannelsLogEvent.CollageRefused, {
                    conversationId: target.id,
                    failure: zaloFailureOf(cause),
                })
                return false
            },
        )
    }
}

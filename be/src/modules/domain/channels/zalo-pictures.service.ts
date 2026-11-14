import { Injectable } from "@nestjs/common"
import type { ChannelTarget } from "./channels.contracts"
import { zaloFailureOf } from "@modules/integrations/zalo"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ChannelImage } from "./channel-image.contracts"
import { ChannelsLogEvent } from "./channels.log-events"

/** Sends one picture to the customer by its public address; rejects when Zalo refuses it. */
export type ZaloPictureSender = (imageUrl: string) => Promise<void>

@Injectable()
/**
 * The pictures of a Zalo reply that follow its text: they go one by one in order. A refusal stops the rest and is only logged: the text
 * already reached the customer.
 */
export class ZaloPicturesService {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** Sends the pictures through `sendOne`, in order; never throws. */
    async send(
        target: ChannelTarget,
        images: ReadonlyArray<ChannelImage>,
        sendOne: ZaloPictureSender,
    ): Promise<void> {
        try {
            await eachInOrder(images, (image) => sendOne(image.url))
        } catch (cause) {
            this.logger.warn(ChannelsLogEvent.ImageFailed, { conversationId: target.id, failure: zaloFailureOf(cause) })
        }
    }
}

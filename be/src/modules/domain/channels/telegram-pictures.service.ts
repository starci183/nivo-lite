import { Injectable } from "@nestjs/common"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { InjectTelegram, TelegramError } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { ChannelImage } from "./channel-image.contracts"
import { IMAGES_MAX, imageRouteOf, telegramCaptionOf } from "./channel-image.policy"
import { ChannelsLogEvent } from "./channels.log-events"

/** The code of a Telegram refusal for the log, or the word unknown. */
const failureOf = (cause: unknown): string => (cause instanceof TelegramError ? cause.code : "unknown")

/** One picture of an album as Telegram takes it. */
interface Photo {
    /** The public address Telegram fetches it from. */
    readonly url: string
    /** The caption under it. */
    readonly caption: string
}

@Injectable()
/**
 * The pictures of a Telegram reply that follow its text: two or more as ONE album with a caption on each, one as a photo. When Telegram refuses
 * the album (one photo it cannot fetch fails the whole album) the photos go one by one, each on its own. A refusal is only logged: the text
 * already reached the customer.
 */
export class TelegramPicturesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectTelegram() private readonly telegram: TelegramClient,
    ) {}

    /** Sends the pictures to the chat with the bot of `token`; never throws. */
    async send(
        target: ChatConversationTarget,
        token: string,
        chatId: string,
        images: ReadonlyArray<ChannelImage>,
    ): Promise<void> {
        const photos = images
            .slice(0, IMAGES_MAX)
            .map((image) => ({ url: image.url, caption: telegramCaptionOf(image.caption) }))
        const route = imageRouteOf("telegram", photos.length, false)
        try {
            if (route === "album") await this.telegram.sendMediaGroup(token, chatId, photos)
            else if (route === "single") await this.sendOne(token, chatId, photos[0])
        } catch (cause) {
            this.logger.warn(ChannelsLogEvent.AlbumFailed, { conversationId: target.id, failure: failureOf(cause) })
            if (route === "album")
                await eachInOrder(photos, (photo) => this.sendOneQuietly(target, token, chatId, photo))
        }
    }

    private async sendOne(token: string, chatId: string, photo: Photo | undefined): Promise<void> {
        if (photo !== undefined) await this.telegram.sendPhoto(token, chatId, photo.url, photo.caption)
    }

    /** Sends one photo of a refused album on its own; one that Telegram refuses is skipped and logged. */
    private sendOneQuietly(target: ChatConversationTarget, token: string, chatId: string, photo: Photo): Promise<void> {
        return this.sendOne(token, chatId, photo).catch((cause: unknown) => {
            this.logger.warn(ChannelsLogEvent.AlbumFailed, { conversationId: target.id, failure: failureOf(cause) })
        })
    }
}

import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import { ContentItemsService } from "@modules/domain/content-items"
import type { ScheduleView } from "@modules/domain/content-items"
import type { WorkContext } from "@modules/domain/decisions"
import { parseMetaSecret } from "@modules/domain/meta-connections"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { BrandImagesService } from "./brand-images.service"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"
import type { ScheduleRequest } from "./content-agent.contracts"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import { MarketingCardsService } from "./marketing-cards.service"
import type { FailedChannel, ScheduledChannel } from "./marketing-cards.contracts"
import { publishMomentOf } from "./schedule-time.policy"

/** The post as one channel publishes it. */
interface ChannelPost {
    readonly title: string
    readonly text: string
    readonly imageUrls: ReadonlyArray<string>
    readonly publishAt: Date
}

const refusal = (reason: string): ContentAiError =>
    new ContentAiError({ code: ContentAiErrorCode.ChannelRefused, params: { reason } })

const reasonOf = (cause: unknown): string => {
    if (cause instanceof ContentAiError) return String(cause.params.reason)
    return cause instanceof Error ? cause.message : "error"
}

@Injectable()
/**
 * Schedules an approved post on the networks: a Facebook Page post that Meta publishes itself at the moment (published=false,
 * scheduled_publish_time, the images uploaded as unpublished photos) and a Zalo OA article (created hidden: the Article API has no
 * publish time). Each channel is independent; the outcome is a `schedule_confirmed` card. A provider refusal never throws.
 */
export class ContentScheduleService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMetaClient() private readonly meta: MetaClient,
        @InjectZalo() private readonly zalo: ZaloClient,
        private readonly connections: ConnectionsService,
        private readonly zaloCredentials: ZaloCredentialsService,
        private readonly items: ContentItemsService,
        private readonly images: BrandImagesService,
        private readonly cards: MarketingCardsService,
    ) {}

    /** Schedules the post on each of its channels and posts the outcome; a post that is gone is left alone. */
    async schedule(ctx: WorkContext, request: ScheduleRequest): Promise<ReadonlyArray<ScheduledChannel>> {
        const item = await this.items.scheduleViewOf(ctx.workspaceId, request.contentItemId)
        if (item === null) return []
        const publishAt = publishMomentOf(this.clock.now(), item.scheduledAt)
        const imageUrls = await this.images.urlsOf(item.mediaPaths)
        const scheduled: Array<ScheduledChannel> = []
        const failed: Array<FailedChannel> = []
        await eachInOrder(item.channels, async (channel) => {
            const post = { title: item.title, text: item.texts[channel] ?? "", imageUrls, publishAt }
            try {
                scheduled.push({ channel, ref: await this.publishOn(ctx.workspaceId, channel, post) })
            } catch (cause) {
                this.logger.error(ContentAgentLogEvent.ChannelRefused, cause, {
                    workspaceId: ctx.workspaceId,
                    channel,
                })
                failed.push({ channel, reason: reasonOf(cause) })
            }
        })
        await this.record(ctx, item, publishAt.toISOString(), scheduled)
        await this.cards.emit(
            { workspaceId: ctx.workspaceId, locale: ctx.locale },
            {
                kind: "schedule_confirmed",
                workItemId: request.workItemId,
                contentItemId: item.id,
                title: item.title,
                scheduledAt: publishAt.toISOString(),
                channels: scheduled,
                failed,
            },
        )
        return scheduled
    }

    private async record(
        ctx: WorkContext,
        item: ScheduleView,
        at: string,
        scheduled: ReadonlyArray<ScheduledChannel>,
    ): Promise<void> {
        await this.items.markScheduled(
            ctx.workspaceId,
            item.id,
            scheduled.map((entry) => ({ channel: entry.channel, ref: entry.ref, scheduledAt: at })),
        )
    }

    private async publishOn(workspaceId: string, channel: string, post: ChannelPost): Promise<string> {
        if (channel === "facebook") {
            const secret = parseMetaSecret(await this.secretOf(workspaceId))
            if (secret.pageId === undefined || secret.pageToken === undefined) throw refusal("facebook_page_missing")
            const result = await this.meta.schedulePagePost(
                { pageId: secret.pageId, pageToken: secret.pageToken },
                { message: post.text, imageUrls: post.imageUrls, publishAt: post.publishAt },
            )
            return result.postId
        }
        if (channel === "zalo") {
            const cover = post.imageUrls[0]
            if (cover === undefined) throw refusal("zalo_cover_missing")
            const token = await this.zaloCredentials.accessToken(await this.connectionOf(workspaceId, "zalo_oa"))
            return this.zalo.createArticle(token, {
                title: post.title,
                author: post.title,
                coverUrl: cover,
                description: post.text,
                paragraphs: post.text.split(/\n{2,}/u),
                publish: false,
            })
        }
        throw refusal(`${channel}_unsupported`)
    }

    private async connectionOf(workspaceId: string, provider: "meta" | "zalo_oa"): Promise<string> {
        const [live] = await this.connections.listByProvider(workspaceId, provider, { includeDisconnected: false })
        if (live === undefined) throw refusal(`${provider}_not_connected`)
        return live.id
    }

    private async secretOf(workspaceId: string): Promise<string> {
        const secret = await this.connections.readSecret(await this.connectionOf(workspaceId, "meta"))
        if (secret === null) throw refusal("meta_credential_missing")
        return secret.plain
    }
}

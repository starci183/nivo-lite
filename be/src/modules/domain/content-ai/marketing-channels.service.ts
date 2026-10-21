import { Injectable } from "@nestjs/common"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import { ContentEngagementDailyService } from "@modules/domain/content-engagement-daily"
import { parseMetaSecret } from "@modules/domain/meta-connections"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient, MetaPageCredentials } from "@modules/integrations/meta"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PublishedPost } from "./content-agent.contracts"
import { ContentAgentLogEvent } from "./content-agent.log-events"

const DAY_MS = 86_400_000
/** How many days back one sync reads: the last two weeks the report compares. */
const SYNC_DAYS = 15
/** The Zalo articles the OA shows; a hidden one is still waiting for its moment. */
const SHOWN = "show"

const dayText = (time: number): string => new Date(time).toISOString().slice(0, 10)

/** An OA token, or null when the workspace has no live Zalo OA. */
type OptionalToken = string | null

@Injectable()
/**
 * What the marketing report reads from the channels (layer 1): the daily Page insights of Meta and the messages customers wrote on
 * Facebook and Zalo OA (counted from the conversations NIVO received) go into `content_engagement_daily`; the posts the Page and the
 * OA published in a week come live from Meta (engagements) and Zalo (views and shares). A channel that is not connected adds
 * nothing; a channel that fails is logged and adds nothing, so the report never shows invented figures.
 */
export class MarketingChannelsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMetaClient() private readonly meta: MetaClient,
        @InjectZalo() private readonly zalo: ZaloClient,
        private readonly connections: ConnectionsService,
        private readonly zaloCredentials: ZaloCredentialsService,
        private readonly daily: ContentEngagementDailyService,
        private readonly messages: AgentMessagesService,
    ) {}

    /** Reads the last fifteen days of Page insights and customer messages into the daily table; answers how many channel days were stored. */
    async sync(workspaceId: string): Promise<number> {
        const today = this.clock.now().getTime()
        const since = dayText(today - SYNC_DAYS * DAY_MS)
        const page = await this.pageOf(workspaceId)
        const insights =
            page === null
                ? 0
                : await this.daily.upsert(
                      workspaceId,
                      "facebook",
                      await this.meta.pageInsights(page, since, dayText(today)),
                  )
        const written = await this.messages.customerMessagesPerDay(workspaceId, since, dayText(today + DAY_MS))
        return insights + (await this.daily.upsertMessages(workspaceId, written))
    }

    /** True when the workspace has a live Page or a live Zalo OA: a report about no channel is not posted. */
    async isConnected(workspaceId: string): Promise<boolean> {
        const [page, oa] = await Promise.all([
            this.pageOf(workspaceId),
            this.connections.listByProvider(workspaceId, "zalo_oa", { includeDisconnected: false }),
        ])
        return page !== null || oa.length > 0
    }

    /** The posts the Page and the OA published from `since` to `until` (days), with what each channel counted. */
    async postsOf(workspaceId: string, since: string, until: string): Promise<ReadonlyArray<PublishedPost>> {
        const [facebook, zalo] = await Promise.all([
            this.facebookPosts(workspaceId, since, until).catch((cause: unknown) => this.skip(cause, workspaceId)),
            this.zaloPosts(workspaceId).catch((cause: unknown) => this.skip(cause, workspaceId)),
        ])
        return [...facebook, ...zalo]
    }

    private async facebookPosts(
        workspaceId: string,
        since: string,
        until: string,
    ): Promise<ReadonlyArray<PublishedPost>> {
        const page = await this.pageOf(workspaceId)
        if (page === null) return []
        const posts = await this.meta.publishedPosts(page, since, until)
        return posts.map((post) => ({
            id: post.id,
            channel: "facebook",
            message: post.message,
            publishedAt: post.createdTime,
            engagements: post.engagements,
            href: post.permalink,
        }))
    }

    /** The shown OA articles; the report keeps those of its week. Zalo counts views and shares, not reactions. */
    private async zaloPosts(workspaceId: string): Promise<ReadonlyArray<PublishedPost>> {
        const token = await this.zaloToken(workspaceId)
        if (token === null) return []
        const articles = await this.zalo.articles(token)
        return articles
            .filter((article) => article.status === SHOWN)
            .map((article) => ({
                id: article.id,
                channel: "zalo",
                message: article.title,
                publishedAt: article.createdAt,
                engagements: article.views + article.shares,
                href: null,
            }))
    }

    private async zaloToken(workspaceId: string): Promise<OptionalToken> {
        const [live] = await this.connections.listByProvider(workspaceId, "zalo_oa", { includeDisconnected: false })
        return live === undefined ? null : this.zaloCredentials.accessToken(live.id)
    }

    /** The chosen Page of the workspace's live Meta connection, or null without one or with an incomplete credential. */
    private async pageOf(workspaceId: string): Promise<MetaPageCredentials | null> {
        const [connection] = await this.connections.listByProvider(workspaceId, "meta", { includeDisconnected: false })
        if (connection === undefined) return null
        const sealed = await this.connections.readSecret(connection.id)
        const secret = parseMetaSecret(sealed?.plain ?? "{}")
        if (secret.pageId === undefined || secret.pageToken === undefined) return null
        return { pageId: secret.pageId, pageToken: secret.pageToken }
    }

    private skip(cause: unknown, workspaceId: string): ReadonlyArray<PublishedPost> {
        this.logger.error(ContentAgentLogEvent.PostsFailed, cause, { workspaceId })
        return []
    }
}

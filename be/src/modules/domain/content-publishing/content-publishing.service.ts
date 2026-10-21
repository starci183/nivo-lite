import { Injectable } from "@nestjs/common"
import { ContentApprovalStoreService, ContentEditorService } from "@modules/domain/content-items"
import type { ContentPublishedResult } from "@modules/domain/content-items"
import { WorkEngineService } from "@modules/domain/decisions"
import { WorkItemsService } from "@modules/domain/work-items"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type {
    MarkContentPublishedRequest,
    SubmitContentRequest,
    SubmittedContent,
} from "./content-publishing.contracts"
import { ContentPublishingError, ContentPublishingErrorCode } from "./errors/content-publishing.error"

const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
const CHANNELS: ReadonlySet<string> = new Set(["facebook", "zalo", "tiktok", "instagram"])

@Injectable()
/** Submits complete drafts through the policy gate and records manually published proof; approval always follows a decision. */
export class ContentPublishingService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly items: ContentEditorService,
        private readonly store: ContentApprovalStoreService,
        private readonly engine: WorkEngineService,
        private readonly works: WorkItemsService,
        private readonly events: EventsService,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Creates an ask-only preset publish_post work item and links the draft before the decision becomes visible. */
    async submit(principalId: string, request: SubmitContentRequest): Promise<SubmittedContent> {
        const member = await this.members.require(principalId, request.workspaceId, MANAGERS)
        const item = await this.items.get(request.workspaceId, request.id)
        if (item.status === "idea") throw new ContentPublishingError({ code: ContentPublishingErrorCode.NotDrafted })
        if (item.status !== "draft") throw new ContentPublishingError({ code: ContentPublishingErrorCode.WrongStatus })
        if (
            item.channels.length === 0 ||
            item.channels.some((channel) => (item.variants[channel]?.text ?? "").trim() === "")
        ) {
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.TextMissing })
        }
        const rounds = item.evidence.filter((line) => line.kind === "submitted").length
        const text = (key: string, params: Record<string, string> = {}): string =>
            this.catalog.get(key, params, request.locale)
        const work = await this.engine.runWork(
            { workspaceId: request.workspaceId, actor: member.displayName, locale: request.locale },
            {
                action: "publish_post",
                subject_type: "inbound",
                subject_id: item.id,
                preset: true,
                noChain: true,
                forceAsk: "over_authority",
                dedupeKey: `publish_post:${item.id}:${item.workItemId ?? "first"}:${rounds + 1}:${item.updatedAt}`,
                seed: {
                    summary: text("contentPublishing.summary", {
                        title: item.title,
                        channels: item.channels.join(", "),
                    }),
                    draft: item.variants[item.channels[0] ?? ""]?.text ?? "",
                    fields: {
                        content_item_id: item.id,
                        channels: item.channels.join(","),
                        scheduled_at: item.scheduledAt ?? "",
                    },
                },
                onInserted: async (row) => {
                    try {
                        await this.store.claimSubmission(
                            request.workspaceId,
                            item.id,
                            row.id,
                            {
                                at: this.clock.now().toISOString(),
                                kind: "submitted",
                                by: member.displayName,
                                text: text("contentPublishing.submitted", { who: member.displayName, id: row.id }),
                            },
                            item,
                        )
                    } catch (cause) {
                        await this.works.markFailed(row.id, ContentPublishingErrorCode.GateFailed)
                        throw cause
                    }
                },
            },
        )
        if (work.status === "failed") {
            await this.store.reject(request.workspaceId, item.id, work.id, {
                at: this.clock.now().toISOString(),
                kind: "submission_failed",
                by: member.displayName,
                text: text("contentPublishing.failed"),
            })
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.GateFailed })
        }
        return { id: item.id, workItemId: work.id, status: work.status }
    }

    /** Marks only approved channels and retains member identity, proof and workspace evidence. */
    async markPublished(principalId: string, request: MarkContentPublishedRequest): Promise<ContentPublishedResult> {
        const member = await this.members.require(principalId, request.workspaceId, MANAGERS)
        const item = await this.items.get(request.workspaceId, request.id)
        if (item.status !== "approved" && item.status !== "published") {
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.WrongStatus })
        }
        if (!CHANNELS.has(request.channel) || !item.channels.includes(request.channel)) {
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.ChannelInvalid })
        }
        const url = request.url.trim()
        if (url !== "" && !/^https?:\/\/[^\s]+$/iu.test(url))
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.UrlInvalid })
        const how = request.how.trim() || this.catalog.get("contentPublishing.defaultHow", {}, request.locale)
        const at = this.clock.now().toISOString()
        const text = this.catalog.get(
            "contentPublishing.published",
            { who: member.displayName, channel: request.channel, proof: url || how },
            request.locale,
        )
        const result = await this.store.markPublished(
            request.workspaceId,
            item.id,
            request.channel,
            { at, by: member.displayName, url, how },
            { at, kind: "published", by: member.displayName, text },
        )
        await this.events.record({
            workspaceId: request.workspaceId,
            kind: "content.published",
            actor: member.displayName,
            summary: this.catalog.get(
                "contentPublishing.event",
                { title: item.title, channel: request.channel },
                request.locale,
            ),
            evidence: url || how,
        })
        return result
    }
}

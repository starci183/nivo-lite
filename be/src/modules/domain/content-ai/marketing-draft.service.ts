import { Injectable } from "@nestjs/common"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { ContentApprovalStoreService, ContentItemsService } from "@modules/domain/content-items"
import type { AgentDraftRef } from "@modules/domain/content-items"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrandImagesService } from "./brand-images.service"
import { BrandKitService } from "./brand-kit.service"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import { MarketingCardsService } from "./marketing-cards.service"
import { MarketingKnowledgeService } from "./marketing-knowledge.service"
import { MarketingVideoService } from "./marketing-video.service"
import { draftMessages, postTextOf, readDraft } from "./marketing-draft.policy"
import type { DraftOutcome, DraftRequest, MarketingDraft } from "./content-agent.contracts"
import type { DraftImage } from "./marketing-cards.contracts"
import { publishMomentOf } from "./schedule-time.policy"

/** The channels a Marketing room request drafts for. */
export const DRAFT_CHANNELS: ReadonlyArray<string> = ["facebook", "zalo"]
const DRAFT_TIMEOUT_MS = 90_000

@Injectable()
/**
 * Turns one "@AI Marketing <request>" into a real draft: the model writes the caption, hashtags, two image texts and a 15 second
 * script in the confirmed brand; ffmpeg composes the two images; the post is stored as a content draft and posted as a `draft_post`
 * card, then submitted to the publish_post gate (always ask) and posted as an `approval_request` card.
 */
export class MarketingDraftService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly generations: DirectGenerationService,
        private readonly brand: BrandKitService,
        private readonly images: BrandImagesService,
        private readonly cards: MarketingCardsService,
        private readonly engine: WorkEngineService,
        private readonly approvals: ContentApprovalStoreService,
        private readonly items: ContentItemsService,
        private readonly video: MarketingVideoService,
        private readonly knowledge: MarketingKnowledgeService,
    ) {}

    /** Drafts the request; a failure of the model or the images is posted in the room and answered, never thrown. */
    async draft(ctx: WorkContext, input: DraftRequest): Promise<DraftOutcome> {
        const scope = { workspaceId: ctx.workspaceId, locale: ctx.locale }
        const [brand, guidance] = await Promise.all([
            this.brand.brandOf(ctx.workspaceId),
            this.knowledge.guidanceOf(ctx.workspaceId, input.request),
        ])
        const outcome = await this.generations.run({
            workspaceId: ctx.workspaceId,
            purpose: "marketing_draft",
            responseFormat: "json",
            timeoutMs: DRAFT_TIMEOUT_MS,
            kind: "engine",
            module: "content",
            locale: ctx.locale,
            messages: draftMessages(input.request, brand.kit, ctx.locale, guidance),
        })
        const draft = outcome.ok ? readDraft(outcome.output) : null
        if (draft === null) {
            const reason = outcome.ok ? "unreadable draft" : outcome.message
            await this.fail(ctx, input.workItemId, reason)
            return { ok: false, reason, contentItemId: null, approvalWorkItemId: null }
        }
        const publishAt = publishMomentOf(this.clock.now(), input.scheduledAt).toISOString()
        const key = `${this.clock.now().getTime()}`
        const images = await this.images
            .compose({
                workspaceId: ctx.workspaceId,
                key,
                copies: draft.images,
                kit: brand.kit,
                logoPath: brand.logoPath,
            })
            .catch(async (cause: unknown) => {
                this.logger.error(ContentAgentLogEvent.ImagesFailed, cause, { workspaceId: ctx.workspaceId })
                await this.fail(ctx, input.workItemId, cause instanceof Error ? cause.message : "images")
                return null
            })
        if (images === null) return { ok: false, reason: "images", contentItemId: null, approvalWorkItemId: null }
        const item = await this.store(ctx, input.request, draft, images, publishAt)
        const brandRef = brand.kit === null ? "brand_kit:none" : `brand_kit:${brand.kit.brandName}`
        await this.cards.emit(scope, {
            kind: "draft_post",
            workItemId: input.workItemId,
            contentItemId: item.id,
            title: draft.title,
            caption: draft.caption,
            hashtags: draft.hashtags,
            images,
            script: draft.script,
            channels: item.channels,
            sources: [
                { layer: 2, ref: brandRef, label: brandRef },
                { layer: 2, ref: "media_library", label: "media_library" },
                { layer: 2, ref: "owner_request", label: "owner_request" },
                ...guidance.sources,
            ],
        })
        const approval = await this.submit(ctx, item, draft, publishAt)
        await this.cards.emit(scope, {
            kind: "approval_request",
            workItemId: approval,
            contentItemId: item.id,
            title: draft.title,
            channels: item.channels,
            scheduledAt: publishAt,
        })
        await this.video.delegate(ctx, draft, images, {
            contentItemId: item.id,
            channels: item.channels,
            parentId: input.workItemId,
        })
        return { ok: true, reason: "", contentItemId: item.id, approvalWorkItemId: approval }
    }

    private store(
        ctx: WorkContext,
        request: string,
        draft: MarketingDraft,
        images: ReadonlyArray<DraftImage>,
        publishAt: string,
    ): Promise<AgentDraftRef> {
        const text = postTextOf(draft)
        const script = draft.script.map((beat) => `${beat.at} ${beat.line}`).join("\n")
        return this.items.createAgentDraft({
            workspaceId: ctx.workspaceId,
            title: draft.title,
            brief: script === "" ? request : `${request}\n\n${script}`,
            channels: DRAFT_CHANNELS,
            scheduledAt: publishAt,
            variants: Object.fromEntries(
                DRAFT_CHANNELS.map((channel) => [channel, { text, hashtags: draft.hashtags, note: "" }]),
            ),
            hashtags: draft.hashtags,
            imagePaths: images.map((image) => image.path),
            actor: ctx.actor,
            evidenceText: request,
            at: this.clock.now().toISOString(),
        })
    }

    /** Submits the stored draft to the publish_post gate, which always asks a person; answers the decision's work item. */
    private async submit(
        ctx: WorkContext,
        item: AgentDraftRef,
        draft: MarketingDraft,
        publishAt: string,
    ): Promise<string> {
        const work = await this.engine.runWork(ctx, {
            action: "publish_post",
            subject_type: "inbound",
            subject_id: item.id,
            preset: true,
            noChain: true,
            forceAsk: "over_authority",
            dedupeKey: `publish_post:${item.id}:first:1`,
            seed: {
                summary: this.catalog.get(
                    "marketing.approvalCard",
                    { title: draft.title, channels: item.channels.join(", ") },
                    ctx.locale,
                ),
                draft: postTextOf(draft),
                fields: { content_item_id: item.id, channels: item.channels.join(","), scheduled_at: publishAt },
            },
            onInserted: async (row) => {
                await this.approvals.claimSubmission(
                    ctx.workspaceId,
                    item.id,
                    row.id,
                    { at: this.clock.now().toISOString(), kind: "submitted", by: ctx.actor, text: row.id },
                    { variants: item.variants, channels: item.channels },
                )
            },
        })
        return work.id
    }

    private async fail(ctx: WorkContext, workItemId: string | null, reason: string): Promise<void> {
        await this.cards.line(
            { workspaceId: ctx.workspaceId, locale: ctx.locale },
            this.catalog.get("marketing.draftFailed", { reason }, ctx.locale),
            workItemId,
        )
    }
}

import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ContentApprovalStoreService } from "@modules/domain/content-items"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ContentPublishingError, ContentPublishingErrorCode } from "./errors/content-publishing.error"

@Injectable()
/** The publish_post performer: a human decision approves the bound draft without posting to a network. */
export class PublishContentPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        private readonly store: ContentApprovalStoreService,
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Registers this action's performer with the existing decisions engine. */
    onModuleInit(): void {
        this.registry.add("publish_post", this)
    }

    /** Publishing uses the supplied draft; no model or provider call is needed. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Approves only the post tied to the exact gate work item that a person decided. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        if (!("kind" in by) || (by.kind !== "owner" && by.kind !== "staff"))
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.WrongStatus })
        const id = this.itemId(ctx, item)
        const summary = this.catalog.get("contentPublishing.approved", { who: by.name, id: item.id }, ctx.locale)
        await this.store.approve(ctx.workspaceId, id, item.id, by.name, proposal.draft ?? null, {
            at: this.clock.now().toISOString(),
            kind: "approved",
            by: by.name,
            text: summary,
        })
        return { summary, evidence: "reviewed" }
    }

    /** A rejected decision returns its own waiting post to draft. */
    async onReject(ctx: WorkContext, item: WorkItem, _proposal: Proposal, by: PerformedBy): Promise<void> {
        await this.store.reject(ctx.workspaceId, this.itemId(ctx, item), item.id, {
            at: this.clock.now().toISOString(),
            kind: "rejected",
            by: by.name,
            text: this.catalog.get("contentPublishing.rejected", { who: by.name }, ctx.locale),
        })
    }

    private itemId(ctx: WorkContext, item: WorkItem): string {
        if (item.workspace_id !== ctx.workspaceId || item.subject_id === null || item.action !== "publish_post") {
            throw new ContentPublishingError({ code: ContentPublishingErrorCode.WrongStatus })
        }
        return item.subject_id
    }
}

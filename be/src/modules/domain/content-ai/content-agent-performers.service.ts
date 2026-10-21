import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
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
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentScheduleService } from "./content-schedule.service"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import { MarketingDraftService } from "./marketing-draft.service"

/** The proposal fields an "@AI Marketing ..." command may carry the request in, in order of preference. */
const REQUEST_FIELDS: ReadonlyArray<string> = ["request", "topic", "brief", "text"]

/** The owner's request of a draft_post item: the first filled request field, else the proposal summary. */
export const draftRequestOf = (proposal: Proposal): string => {
    for (const key of REQUEST_FIELDS) {
        const value = proposal.fields[key]
        if (typeof value === "string" && value.trim() !== "") return value.trim()
    }
    return proposal.summary
}

const textField = (proposal: Proposal, key: string): string | null => {
    const value = proposal.fields[key]
    return typeof value === "string" && value !== "" ? value : null
}

@Injectable()
/**
 * Wires AI Marketing into the decisions engine. `draft_post` (auto) starts the draft in the background and answers at once, so the
 * Office confirm is not held by the model and ffmpeg. `publish_post` keeps the content capability's approval and, once a person
 * approved, schedules the post on the networks. Registered at bootstrap, after every capability added its own performers.
 */
export class ContentAgentPerformersService implements OnApplicationBootstrap {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectLogger() private readonly logger: Logger,
        private readonly drafts: MarketingDraftService,
        private readonly schedule: ContentScheduleService,
    ) {}

    /** Registers draft_post and wraps the existing publish_post performer. */
    onApplicationBootstrap(): void {
        this.registry.add("draft_post", this.draftPerformer())
        const approve = this.registry.performerOf("publish_post")
        if (approve !== null) this.registry.add("publish_post", this.schedulingPerformer(approve))
    }

    /** The draft_post performer: the proposal is the command as sent; performing starts the draft. */
    draftPerformer(): WorkPerformer {
        return {
            prepare: (_ctx: WorkContext, item: WorkItem): Promise<Prepared> =>
                Promise.resolve({ proposal: item.proposal }),
            perform: (ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> => {
                const request = draftRequestOf(proposal)
                void this.drafts
                    .draft(ctx, { request, workItemId: item.id, scheduledAt: textField(proposal, "scheduled_at") })
                    .catch((cause: unknown) => {
                        this.logger.error(ContentAgentLogEvent.DraftFailed, cause, { workspaceId: ctx.workspaceId })
                    })
                return Promise.resolve({ summary: request, evidence: "pending" })
            },
        }
    }

    /** publish_post as the content capability performs it, then the scheduling of the approved post. */
    schedulingPerformer(approve: WorkPerformer): WorkPerformer {
        return {
            prepare: (ctx: WorkContext, item: WorkItem): Promise<Prepared> => approve.prepare(ctx, item),
            perform: async (
                ctx: WorkContext,
                item: WorkItem,
                proposal: Proposal,
                by: PerformedBy,
            ): Promise<Performed> => {
                const performed = await approve.perform(ctx, item, proposal, by)
                if (item.subject_id !== null) {
                    await this.schedule
                        .schedule(ctx, { contentItemId: item.subject_id, workItemId: item.id })
                        .catch((cause: unknown) => {
                            this.logger.error(ContentAgentLogEvent.ScheduleFailed, cause, {
                                workspaceId: ctx.workspaceId,
                            })
                        })
                }
                return performed
            },
            onReject: async (ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<void> => {
                await approve.onReject?.(ctx, item, proposal, by)
            },
        }
    }
}

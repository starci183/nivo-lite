import { Injectable } from "@nestjs/common"
import type { ApprovalRequest, ApprovalRequester, ApprovalResult, ToolContext } from "@modules/domain/agent-tools"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkEngineService } from "./work-engine.service"

const ENGINE_ACTOR = "NIVO"
const QUESTION_SUMMARY_CHARS = 160

@Injectable()
/** Asks the owner to approve an answer an agent could not give alone: a preset reply_customer work item that always waits for a person. */
export class ApprovalRequesterService implements ApprovalRequester {
    constructor(
        private readonly engine: WorkEngineService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Puts the proposed answer through the gate; one request per job, a repeat returns the same item. */
    async request(ctx: ToolContext, request: ApprovalRequest): Promise<ApprovalResult> {
        const summary = this.catalog.get(
            "engine.replySummary",
            { question: request.question.slice(0, QUESTION_SUMMARY_CHARS) },
            "vi",
        )
        const item = await this.engine.runWork(
            { workspaceId: ctx.workspaceId, actor: ENGINE_ACTOR, locale: "vi" },
            {
                action: "reply_customer",
                subject_type: "conversation",
                subject_id: ctx.conversationId,
                dedupeKey: `reply_customer:engine:${ctx.jobId}`,
                origin: "live",
                preset: true,
                noChain: true,
                forceAsk: request.reason,
                seed: {
                    summary,
                    draft: request.proposedAnswer ?? "",
                    fields: { question: request.question, conversation_id: ctx.conversationId },
                },
            },
        )
        return { workItemId: item.id, status: item.status }
    }
}

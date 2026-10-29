import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AI_TASKS } from "@modules/domain/ai-tasks"
import { LeadGenQueueModule } from "@modules/queues/lead-gen"
import { AskQualifyingPerformerService } from "./ask-qualifying-performer.service"
import { CaptureLeadPerformerService } from "./capture-lead-performer.service"
import { CloseLeadPerformerService } from "./close-lead-performer.service"
import { FollowUpLeadPerformerService } from "./follow-up-lead-performer.service"
import { GreetProspectPerformerService } from "./greet-prospect-performer.service"
import { HandoffToSalesPerformerService } from "./handoff-to-sales-performer.service"
import { HumanAgentTagPerformerService } from "./human-agent-tag-performer.service"
import { LeadAdsIntakeService } from "./lead-ads-intake.service"
import { LeadFlowChainService } from "./lead-flow-chain.service"
import { LeadFlowContinuationService } from "./lead-flow-continuation.service"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { LeadFlowTurnService } from "./lead-flow-turn.service"
import { LEAD_TURN_READER } from "./lead-flows.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-flows.module-definition"
import { LeadGenIntakeService } from "./lead-gen-intake.service"
import { PrivateReplyCommentPerformerService } from "./private-reply-comment-performer.service"
import { ReplyCommentPublicPerformerService } from "./reply-comment-public-performer.service"
import { ScoreLeadPerformerService } from "./score-lead-performer.service"

@Module({})
/**
 * The lead generation flow (lead_gen): Facebook and Instagram comments, mentions, messages and Lead Ads become leads that are scored,
 * qualified, answered and handed to Sales. It owns public.lead_flows, registers the lead_gen performers with the work engine, and is the
 * engine's `LeadGenFlow` port.
 */
export class LeadFlowsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app, after the decisions capability. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), LeadGenQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: LEAD_TURN_READER, useExisting: AI_TASKS },
                LeadFlowStoreService,
                LeadFlowMetaService,
                LeadFlowConversationService,
                LeadFlowKitService,
                LeadFlowTurnService,
                LeadFlowChainService,
                LeadFlowContinuationService,
                LeadGenIntakeService,
                LeadAdsIntakeService,
                CaptureLeadPerformerService,
                ScoreLeadPerformerService,
                GreetProspectPerformerService,
                AskQualifyingPerformerService,
                FollowUpLeadPerformerService,
                CloseLeadPerformerService,
                ReplyCommentPublicPerformerService,
                PrivateReplyCommentPerformerService,
                HandoffToSalesPerformerService,
                HumanAgentTagPerformerService,
            ],
            exports: [LeadFlowStoreService, LeadFlowChainService, LeadFlowContinuationService, LeadGenIntakeService],
        }
    }
}

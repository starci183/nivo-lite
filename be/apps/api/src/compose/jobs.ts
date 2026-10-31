import { BankFeedDeliveryQueueModule } from "@features/jobs/bank-feed-delivery"
import { SepayDeliveryQueueModule } from "@features/jobs/sepay-delivery"
import { ZaloDeliveryQueueModule } from "@features/jobs/zalo-delivery"
import { TelegramDeliveryQueueModule } from "@features/jobs/telegram-delivery"
import { MetaDeliveryQueueModule } from "@features/jobs/meta-delivery"
import type { DynamicModule } from "@nestjs/common"
import { RunDataSyncQueueModule } from "@features/jobs/run-data-sync"
import { ExtractKnowledgeFactsQueueModule } from "@features/jobs/extract-knowledge-facts"
import { ReviewDossiersQueueModule } from "@features/jobs/review-dossiers"
import { DraftDossierRemedyQueueModule } from "@features/jobs/draft-dossier-remedy"
import { RunBrainCommandQueueModule } from "@features/jobs/run-brain-command"
import { IndexKnowledgeSourceQueueModule } from "@features/jobs/index-knowledge-source"
import { ReembedKnowledgeQueueModule } from "@features/jobs/reembed-knowledge"
import { EmitN8nEventQueueModule } from "@features/jobs/emit-n8n-event"
import { EmitWebhookEventQueueModule } from "@features/jobs/emit-webhook-event"
import { RunAutomationCommandQueueModule } from "@features/jobs/run-automation-command"
import { RunAutomationTickQueueModule } from "@features/jobs/run-automation-tick"
import { RunDecisionsQueueModule } from "@features/jobs/run-decisions"
import { RunSetupTurnQueueModule } from "@features/jobs/run-setup-turn"
import { GenerateWithAgentQueueModule } from "@features/jobs/generate-with-agent"
import { SyncAgentsQueueModule } from "@features/jobs/sync-agents"
import { DrainWorkQueueModule } from "@features/jobs/drain-work"
import { ExpireApprovalsQueueModule } from "@features/jobs/expire-approvals"
import { DraftLoyaltyCampaignQueueModule } from "@features/jobs/draft-loyalty-campaign"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { CompleteZaloAuthorizationQueueModule } from "@features/jobs/complete-zalo-authorization"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { RunZaloWizardQueueModule } from "@features/jobs/run-zalo-wizard"
import { RunChatTurnQueueModule } from "@features/jobs/run-chat-turn"
import { RunLeadActionQueueModule } from "@features/jobs/run-lead-action"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { CreatePaymentOrderQueueModule } from "@features/jobs/create-payment-order"
import { PublishContentQueueModule } from "@features/jobs/publish-content"
import { AcceptMetaEventQueueModule } from "@features/jobs/accept-meta-event"
import { IssueInviteQueueModule } from "@features/jobs/issue-invite"
import { RenderVideoQueueModule } from "@features/jobs/render-video"
import { ConnectionCommandsQueueModule } from "@features/jobs/connection-commands"
import { RequestRenderQueueModule } from "@features/jobs/request-render"
import { ReplenishStockQueueModule } from "@features/jobs/replenish-stock"
import { HiringTickQueueModule } from "@features/jobs/hiring-tick"
import { RunShiftsAlertsQueueModule } from "@features/jobs/run-shifts-alerts"
import { RunAccountingMorningQueueModule } from "@features/jobs/run-accounting-morning"
import { RunMarketingTickQueueModule } from "@features/jobs/run-marketing-tick"
import { RunLeadGenQueueModule } from "@features/jobs/run-lead-gen"
import { SweepRealtimeEventsQueueModule } from "@features/jobs/sweep-realtime-events"
import { SweepSystemHistoryQueueModule } from "@features/jobs/sweep-system-history"

/** The background jobs the api runs: each queue module registers its processor with the job runner. */
export const API_JOB_QUEUES: Array<DynamicModule> = [
    MetaDeliveryQueueModule.register({}),
    TelegramDeliveryQueueModule.register({}),
    ZaloDeliveryQueueModule.register({}),
    SepayDeliveryQueueModule.register({}),
    BankFeedDeliveryQueueModule.register({}),
    RunDataSyncQueueModule.register({}),
    ExtractKnowledgeFactsQueueModule.register({}),
    ReviewDossiersQueueModule.register({}),
    DraftDossierRemedyQueueModule.register({}),
    RunBrainCommandQueueModule.register({}),
    IndexKnowledgeSourceQueueModule.register({}),
    ReembedKnowledgeQueueModule.register({}),
    EmitN8nEventQueueModule.register({}),
    EmitWebhookEventQueueModule.register({}),
    RunAutomationCommandQueueModule.register({}),
    RunAutomationTickQueueModule.register({}),
    RunDecisionsQueueModule.register({}),
    RunSetupTurnQueueModule.register({}),
    GenerateWithAgentQueueModule.register({}),
    SyncAgentsQueueModule.register({}),
    DrainWorkQueueModule.register({}),
    ExpireApprovalsQueueModule.register({}),
    DraftLoyaltyCampaignQueueModule.register({}),
    CheckConnectionHealthQueueModule.register({}),
    CompleteZaloAuthorizationQueueModule.register({}),
    RefreshZaloTokensQueueModule.register({}),
    RunZaloWizardQueueModule.register({}),
    RunChatTurnQueueModule.register({}),
    RunLeadActionQueueModule.register({}),
    ProcessPublicApiQueueModule.register({}),
    CreatePaymentOrderQueueModule.register({}),
    PublishContentQueueModule.register({}),
    AcceptMetaEventQueueModule.register({}),
    RunLeadGenQueueModule.register({}),
    SweepRealtimeEventsQueueModule.register({}),
    SweepSystemHistoryQueueModule.register({}),
    IssueInviteQueueModule.register({}),
    RenderVideoQueueModule.register({}),
    ConnectionCommandsQueueModule.register({}),
    RequestRenderQueueModule.register({}),
    ReplenishStockQueueModule.register({}),
    HiringTickQueueModule.register({}),
    RunShiftsAlertsQueueModule.register({}),
    RunAccountingMorningQueueModule.register({}),
    RunMarketingTickQueueModule.register({}),
]

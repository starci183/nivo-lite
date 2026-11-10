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
import { DraftPublicDocumentQueueModule } from "@features/jobs/draft-public-document"
import { RunBrainCommandQueueModule } from "@features/jobs/run-brain-command"
import { IndexKnowledgeSourceQueueModule } from "@features/jobs/index-knowledge-source"
import { ReembedKnowledgeQueueModule } from "@features/jobs/reembed-knowledge"
import { EmitWebhookEventQueueModule } from "@features/jobs/emit-webhook-event"
import { RunSetupTurnQueueModule } from "@features/jobs/run-setup-turn"
import { GenerateWithAgentQueueModule } from "@features/jobs/generate-with-agent"
import { SyncAgentsQueueModule } from "@features/jobs/sync-agents"
import { ExpireApprovalsQueueModule } from "@features/jobs/expire-approvals"
import { WatchAgentGraphsQueueModule } from "@features/jobs/watch-agent-graphs"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { CompleteZaloAuthorizationQueueModule } from "@features/jobs/complete-zalo-authorization"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { PollDueConnectionsQueueModule } from "@features/jobs/poll-due-connections"
import { ReconcileZaloInboxQueueModule } from "@features/jobs/reconcile-zalo-inbox"
import { ReconcileBankFeedQueueModule } from "@features/jobs/reconcile-bank-feed"
import { RunZaloWizardQueueModule } from "@features/jobs/run-zalo-wizard"
import { RunModuleJobQueueModule } from "@features/jobs/module-jobs"
import { ParkedJobsQueueModule } from "@features/jobs/parked-jobs"
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
import { SweepRealtimeEventsQueueModule } from "@features/jobs/sweep-realtime-events"
import { SweepSystemHistoryQueueModule } from "@features/jobs/sweep-system-history"
import { DeliverGenericWebhookQueueModule } from "@features/jobs/deliver-generic-webhook"
import { RunAgentStepQueueModule } from "@features/jobs/run-agent-step"
import { FireThreadDeadlineQueueModule } from "@features/jobs/fire-thread-deadline"
import { RunAgentTurnQueueModule } from "@features/jobs/run-agent-turn"
import { FireAgentScheduleQueueModule } from "@features/jobs/fire-agent-schedule"
import { SweepAgentWorkQueueModule } from "@features/jobs/sweep-agent-work"

/** The background jobs the api runs: each queue module registers its processor with the job runner. */
export const API_JOB_QUEUES: Array<DynamicModule> = [
    MetaDeliveryQueueModule.register({}),
    TelegramDeliveryQueueModule.register({}),
    ZaloDeliveryQueueModule.register({}),
    SepayDeliveryQueueModule.register({}),
    BankFeedDeliveryQueueModule.register({}),
    ReconcileBankFeedQueueModule.register({}),
    RunDataSyncQueueModule.register({}),
    ExtractKnowledgeFactsQueueModule.register({}),
    ReviewDossiersQueueModule.register({}),
    DraftDossierRemedyQueueModule.register({}),
    DraftPublicDocumentQueueModule.register({}),
    RunBrainCommandQueueModule.register({}),
    IndexKnowledgeSourceQueueModule.register({}),
    ReembedKnowledgeQueueModule.register({}),
    EmitWebhookEventQueueModule.register({}),
    RunSetupTurnQueueModule.register({}),
    GenerateWithAgentQueueModule.register({}),
    SyncAgentsQueueModule.register({}),
    ExpireApprovalsQueueModule.register({}),
    WatchAgentGraphsQueueModule.register({}),
    CheckConnectionHealthQueueModule.register({}),
    CompleteZaloAuthorizationQueueModule.register({}),
    RefreshZaloTokensQueueModule.register({}),
    ReconcileZaloInboxQueueModule.register({}),
    PollDueConnectionsQueueModule.register({}),
    RunZaloWizardQueueModule.register({}),
    RunModuleJobQueueModule.register({}),
    ParkedJobsQueueModule.register({}),
    ProcessPublicApiQueueModule.register({}),
    CreatePaymentOrderQueueModule.register({}),
    PublishContentQueueModule.register({}),
    AcceptMetaEventQueueModule.register({}),
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
    RunAgentStepQueueModule.register({}),
    FireThreadDeadlineQueueModule.register({}),
    DeliverGenericWebhookQueueModule.register({}),
    RunAgentTurnQueueModule.register({}),
    FireAgentScheduleQueueModule.register({}),
    SweepAgentWorkQueueModule.register({}),
]

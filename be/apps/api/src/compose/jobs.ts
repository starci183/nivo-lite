import { BankFeedDeliveryQueueModule } from "@features/jobs/bank-feed-delivery"
import { SepayDeliveryQueueModule } from "@features/jobs/sepay-delivery"
import { ZaloDeliveryQueueModule } from "@features/jobs/zalo-delivery"
import { TelegramDeliveryQueueModule } from "@features/jobs/telegram-delivery"
import { MetaDeliveryQueueModule } from "@features/jobs/meta-delivery"
import type { DynamicModule } from "@nestjs/common"
import { RunDataSyncQueueModule } from "@features/jobs/run-data-sync"
import { ExtractKnowledgeFactsQueueModule } from "@features/jobs/extract-knowledge-facts"
import { ReviewDossiersQueueModule } from "@features/jobs/review-dossiers"
import { DraftPublicDocumentQueueModule } from "@features/jobs/draft-public-document"
import { RunBrainCommandQueueModule } from "@features/jobs/run-brain-command"
import { DeriveBrainPoliciesQueueModule } from "@features/jobs/derive-brain-policies"
import { IndexKnowledgeSourceQueueModule } from "@features/jobs/index-knowledge-source"
import { EmitWebhookEventQueueModule } from "@features/jobs/emit-webhook-event"
import { RunSetupTurnQueueModule } from "@features/jobs/run-setup-turn"
import { GenerateWithAgentQueueModule } from "@features/jobs/generate-with-agent"
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
import { AcceptMetaEventQueueModule } from "@features/jobs/accept-meta-event"
import { IssueInviteQueueModule } from "@features/jobs/issue-invite"
import { ConnectionCommandsQueueModule } from "@features/jobs/connection-commands"
import { SweepRealtimeEventsQueueModule } from "@features/jobs/sweep-realtime-events"
import { SweepSystemHistoryQueueModule } from "@features/jobs/sweep-system-history"
import { SweepAccountDataQueueModule } from "@features/jobs/sweep-account-data"
import { DeliverGenericWebhookQueueModule } from "@features/jobs/deliver-generic-webhook"
import { DeliverTeamChatTagQueueModule } from "@features/jobs/deliver-team-chat-tag"
import { DeliverWorkflowStartQueueModule } from "@features/jobs/deliver-workflow-start"
import { FireThreadDeadlineQueueModule } from "@features/jobs/fire-thread-deadline"
import { RunAgentTurnQueueModule } from "@features/jobs/run-agent-turn"
import { FireAgentScheduleQueueModule } from "@features/jobs/fire-agent-schedule"
import { SweepAgentWorkQueueModule } from "@features/jobs/sweep-agent-work"
import { SyncVectorsQueueModule } from "@features/jobs/sync-vectors"
import { ReconcileVectorsQueueModule } from "@features/jobs/reconcile-vectors"

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
    DraftPublicDocumentQueueModule.register({}),
    RunBrainCommandQueueModule.register({}),
    DeriveBrainPoliciesQueueModule.register({}),
    IndexKnowledgeSourceQueueModule.register({}),
    EmitWebhookEventQueueModule.register({}),
    RunSetupTurnQueueModule.register({}),
    GenerateWithAgentQueueModule.register({}),
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
    AcceptMetaEventQueueModule.register({}),
    SweepRealtimeEventsQueueModule.register({}),
    SweepSystemHistoryQueueModule.register({}),
    SweepAccountDataQueueModule.register({}),
    IssueInviteQueueModule.register({}),
    ConnectionCommandsQueueModule.register({}),
    FireThreadDeadlineQueueModule.register({}),
    DeliverGenericWebhookQueueModule.register({}),
    // A tag posted in /chat (by the api or the mcp gateway) is queued; only the api delivers it through the one event pipeline (R24).
    DeliverTeamChatTagQueueModule.register({}),
    // A person's start of a workflow (through the api or the mcp gateway) is queued; only the api delivers it (R24).
    DeliverWorkflowStartQueueModule.register({}),
    RunAgentTurnQueueModule.register({}),
    FireAgentScheduleQueueModule.register({}),
    SweepAgentWorkQueueModule.register({}),
    SyncVectorsQueueModule.register({}),
    ReconcileVectorsQueueModule.register({}),
]

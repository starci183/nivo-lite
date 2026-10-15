import type { ModuleMetadata } from "@nestjs/common"
import { RunDataSyncQueueModule } from "@features/jobs/run-data-sync"
import { ExtractKnowledgeFactsQueueModule } from "@features/jobs/extract-knowledge-facts"
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
import { DraftLoyaltyCampaignQueueModule } from "@features/jobs/draft-loyalty-campaign"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { CompleteZaloAuthorizationQueueModule } from "@features/jobs/complete-zalo-authorization"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { RunZaloWizardQueueModule } from "@features/jobs/run-zalo-wizard"
import { RunChatTurnQueueModule } from "@features/jobs/run-chat-turn"
import { RunLeadActionQueueModule } from "@features/jobs/run-lead-action"
import { ReconcileBankCreditQueueModule } from "@features/jobs/reconcile-bank-credit"
import { CreatePaymentOrderQueueModule } from "@features/jobs/create-payment-order"
import { ApplyBookingStatusQueueModule } from "@features/jobs/apply-booking-status"
import { PublishContentQueueModule } from "@features/jobs/publish-content"
import { AcceptMetaEventQueueModule } from "@features/jobs/accept-meta-event"
import { IssueInviteQueueModule } from "@features/jobs/issue-invite"
import { RenderVideoQueueModule } from "@features/jobs/render-video"
import { ConnectionCommandsQueueModule } from "@features/jobs/connection-commands"
import { RequestRenderQueueModule } from "@features/jobs/request-render"
import { DeductOrderQueueModule } from "@features/jobs/deduct-order"
import { ReplenishStockQueueModule } from "@features/jobs/replenish-stock"
import { HiringTickQueueModule } from "@features/jobs/hiring-tick"
import { RunShiftsAlertsQueueModule } from "@features/jobs/run-shifts-alerts"
import { RunLeadGenQueueModule } from "@features/jobs/run-lead-gen"

/** The background jobs the api runs: each queue module registers its processor with the job runner. */
export const API_JOB_QUEUES = [
    RunDataSyncQueueModule,
    ExtractKnowledgeFactsQueueModule,
    RunBrainCommandQueueModule,
    IndexKnowledgeSourceQueueModule,
    ReembedKnowledgeQueueModule,
    EmitN8nEventQueueModule,
    EmitWebhookEventQueueModule,
    RunAutomationCommandQueueModule,
    RunAutomationTickQueueModule,
    RunDecisionsQueueModule,
    RunSetupTurnQueueModule,
    GenerateWithAgentQueueModule,
    SyncAgentsQueueModule,
    DrainWorkQueueModule,
    DraftLoyaltyCampaignQueueModule,
    CheckConnectionHealthQueueModule,
    CompleteZaloAuthorizationQueueModule,
    RefreshZaloTokensQueueModule,
    RunZaloWizardQueueModule,
    RunChatTurnQueueModule,
    RunLeadActionQueueModule,
    ReconcileBankCreditQueueModule,
    CreatePaymentOrderQueueModule,
    ApplyBookingStatusQueueModule,
    PublishContentQueueModule,
    AcceptMetaEventQueueModule,
    RunLeadGenQueueModule,
    IssueInviteQueueModule,
    RenderVideoQueueModule,
    ConnectionCommandsQueueModule,
    RequestRenderQueueModule,
    DeductOrderQueueModule,
    ReplenishStockQueueModule,
    HiringTickQueueModule,
    RunShiftsAlertsQueueModule,
] satisfies NonNullable<ModuleMetadata["imports"]>

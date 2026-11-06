import { appErrorsEntities } from "@modules/domain/app-errors"
import { agentAccessLogEntities } from "@modules/domain/agent-access-log"
import { agentConnectionsEntities } from "@modules/domain/agent-connections"
import { agentsEntities } from "@modules/domain/agents"
import { aiGenerationsEntities } from "@modules/domain/ai-generations"
import { aiQuotaOverridesEntities } from "@modules/domain/ai-quota-overrides"
import { aiUsageEventsEntities } from "@modules/domain/ai-usage-events"
import { apiKeysEntities } from "@modules/domain/api-keys"
import { appCommandsEntities } from "@modules/domain/app-commands"
import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import { authorityEntities } from "@modules/domain/authority"
import { authorityActionsEntities } from "@modules/domain/authority-actions"
import { authorityRulesEntities } from "@modules/domain/authority-rules"
import { automationPipelinesEntities } from "@modules/domain/automation-pipelines"
import { automationTemplatesEntities } from "@modules/domain/automation-templates"
import { bankFeedInboxEntities } from "@modules/domain/bank-feed-inbox"
import { connectionPollEntities } from "@modules/domain/connection-poll"
import { billingEntities } from "@modules/domain/billing"
import { bookingExceptionsEntities } from "@modules/domain/booking-exceptions"
import { bookingHoursEntities } from "@modules/domain/booking-hours"
import { bookingRemindersEntities } from "@modules/domain/booking-reminders"
import { bookingResourcesEntities } from "@modules/domain/booking-resources"
import { bookingServicesEntities } from "@modules/domain/booking-services"
import { bookingSettingsEntities } from "@modules/domain/booking-settings"
import { bookingWaitlistEntities } from "@modules/domain/booking-waitlist"
import { bookingsEntities } from "@modules/domain/bookings"
import { brainEntities } from "@modules/domain/brain"
import { brainCommandsEntities } from "@modules/domain/brain-commands"
import { brainDossiersEntities } from "@modules/domain/brain-dossiers"
import { brainEvalCasesEntities } from "@modules/domain/brain-eval-cases"
import { brainExtractionsEntities } from "@modules/domain/brain-extractions"
import { brainFactsEntities } from "@modules/domain/brain-facts"
import { brainLessonsEntities } from "@modules/domain/brain-lessons"
import { channelConnectionsEntities } from "@modules/domain/channel-connections"
import { channelReceiptsEntities } from "@modules/domain/channel-receipts"
import { chatFilesEntities } from "@modules/domain/chat-files"
import { chatMarkersEntities } from "@modules/domain/chat-markers"
import { connectionCommandsEntities } from "@modules/domain/connection-commands"
import { connectionSecretsEntities } from "@modules/domain/connection-secrets"
import { connectionsEntities } from "@modules/domain/connections"
import { connectorInterestEntities } from "@modules/domain/connector-interest"
import { contentBrandProposalsEntities } from "@modules/domain/content-brand-proposals"
import { contentCadenceEntities } from "@modules/domain/content-cadence"
import { contentEngagementDailyEntities } from "@modules/domain/content-engagement-daily"
import { contentItemsEntities } from "@modules/domain/content-items"
import { contentPillarsEntities } from "@modules/domain/content-pillars"
import { contentPlansEntities } from "@modules/domain/content-plans"
import { contentSettingsEntities } from "@modules/domain/content-settings"
import { contentWeeklyReportsEntities } from "@modules/domain/content-weekly-reports"
import { creditsEntities } from "@modules/domain/credits"
import { dataRecordsEntities } from "@modules/domain/data-records"
import { dataSyncRunsEntities } from "@modules/domain/data-sync-runs"
import { decisionsEntities } from "@modules/domain/decisions"
import { dossierReviewEntities } from "@modules/domain/dossier-review"
import { emailMessagesEntities } from "@modules/domain/email-messages"
import { eventsEntities } from "@modules/domain/events"
import { hiringEntities } from "@modules/domain/hiring"
import { identityEntities } from "@modules/domain/identity"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { inventoryEntities } from "@modules/domain/inventory"
import { invoicesEntities } from "@modules/domain/invoices"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"
import { knowledgeGapsEntities } from "@modules/domain/knowledge-gaps"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { knowledgeSuggestionStateEntities } from "@modules/domain/knowledge-suggestion-state"
import { mcpCallLogEntities } from "@modules/domain/mcp-call-log"
import { mcpConnectorsEntities } from "@modules/domain/mcp-connectors"
import { mcpGatewayReceiptsEntities } from "@modules/domain/mcp-gateway-receipts"
import { mcpToolGrantsEntities } from "@modules/domain/mcp-tool-grants"
import { memberGrantsEntities } from "@modules/domain/member-grants"
import { messagesEntities } from "@modules/domain/messages"
import { metaCommentsEntities } from "@modules/domain/meta-comments"
import { metaInboxEntities } from "@modules/domain/meta-inbox"
import { metaThreadsEntities } from "@modules/domain/meta-threads"
import { moduleContextNotesEntities } from "@modules/domain/module-context-notes"
import { moduleContextVersionsEntities } from "@modules/domain/module-context-versions"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import { moduleSetupMessagesEntities } from "@modules/domain/module-setup-messages"
import { moduleSetupSessionsEntities } from "@modules/domain/module-setup-sessions"
import { moduleSetupWritesEntities } from "@modules/domain/module-setup-writes"
import { modulesEntities } from "@modules/domain/modules"
import { nivoKnowledgeEntities } from "@modules/domain/nivo-knowledge"
import { officeRoomsEntities } from "@modules/domain/office-rooms"
import { openclawAgentSyncEntities } from "@modules/domain/openclaw-agent-sync"
import { paymentOrderRequestsEntities } from "@modules/domain/payment-order-requests"
import { paymentOrdersEntities } from "@modules/domain/payment-orders"
import { platformAdminEntities } from "@modules/domain/platform-admin"
import { platformAuditEntities } from "@modules/domain/platform-audit"
import { publicApiEntities } from "@modules/domain/public-api"
import { publicDocumentsEntities } from "@modules/domain/public-documents"
import { sepayTransactionsEntities } from "@modules/domain/sepay-transactions"
import { shiftsEntities } from "@modules/domain/shifts"
import { staffEntities } from "@modules/domain/staff"
import { supplierPayablesEntities } from "@modules/domain/supplier-payables"
import { telegramInboxEntities } from "@modules/domain/telegram-inbox"
import { agentTemplatesEntities } from "@modules/domain/agent-templates"
import { templateMarketplaceEntities } from "@modules/domain/template-marketplace"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import { agentWorkEntities } from "@modules/domain/agent-work"
import { transactionsEntities } from "@modules/domain/transactions"
import { videoBrandKitsEntities } from "@modules/domain/video-brand-kits"
import { videoDelegationsEntities } from "@modules/domain/video-delegations"
import { videoProjectVersionsEntities } from "@modules/domain/video-project-versions"
import { videoProjectsEntities } from "@modules/domain/video-projects"
import { videoRendersEntities } from "@modules/domain/video-renders"
import { workItemsEntities } from "@modules/domain/work-items"
import { workspaceInvitesEntities } from "@modules/domain/workspace-invites"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"
import { zaloInboxEntities } from "@modules/domain/zalo-inbox"
import { zaloWizardDraftsEntities } from "@modules/domain/zalo-wizard-drafts"
import type { DatabaseOptions } from "./database.options"
import { databaseEntities } from "./persistence/entities"
import { inboxEntities } from "@modules/platform/inbox"
import { jobsEntities } from "@modules/platform/jobs"
import { realtimeEntities } from "@modules/platform/realtime"

/**
 * The one list of entity classes the primary connection maps (ruling lite-persistence-typeorm-entities): app composition and test
 * worlds import it by this deep path; DatabaseModule and the database barrel never do. Each capability contributes its
 * `<c>Entities` array through its barrel. No globs.
 */
export const PRIMARY_ENTITIES: DatabaseOptions["entities"] = [
    ...appErrorsEntities,
    ...agentAccessLogEntities,
    ...agentConnectionsEntities,
    ...agentsEntities,
    ...aiGenerationsEntities,
    ...aiQuotaOverridesEntities,
    ...aiUsageEventsEntities,
    ...apiKeysEntities,
    ...appCommandsEntities,
    ...approvalRequestsEntities,
    ...authorityEntities,
    ...authorityActionsEntities,
    ...authorityRulesEntities,
    ...automationPipelinesEntities,
    ...automationTemplatesEntities,
    ...bankFeedInboxEntities,
    ...connectionPollEntities,
    ...billingEntities,
    ...bookingExceptionsEntities,
    ...bookingHoursEntities,
    ...bookingRemindersEntities,
    ...bookingResourcesEntities,
    ...bookingServicesEntities,
    ...bookingSettingsEntities,
    ...bookingWaitlistEntities,
    ...bookingsEntities,
    ...brainEntities,
    ...brainCommandsEntities,
    ...brainDossiersEntities,
    ...dossierReviewEntities,
    ...brainEvalCasesEntities,
    ...brainExtractionsEntities,
    ...brainFactsEntities,
    ...brainLessonsEntities,
    ...channelConnectionsEntities,
    ...channelReceiptsEntities,
    ...chatFilesEntities,
    ...chatMarkersEntities,
    ...connectionCommandsEntities,
    ...connectionSecretsEntities,
    ...connectionsEntities,
    ...connectorInterestEntities,
    ...contentBrandProposalsEntities,
    ...contentCadenceEntities,
    ...contentEngagementDailyEntities,
    ...contentItemsEntities,
    ...contentPillarsEntities,
    ...contentPlansEntities,
    ...contentSettingsEntities,
    ...contentWeeklyReportsEntities,
    ...creditsEntities,
    ...dataRecordsEntities,
    ...dataSyncRunsEntities,
    ...decisionsEntities,
    ...emailMessagesEntities,
    ...eventsEntities,
    ...hiringEntities,
    ...identityEntities,
    ...inboundEventsEntities,
    ...inventoryEntities,
    ...invoicesEntities,
    ...knowledgeChunksEntities,
    ...knowledgeGapsEntities,
    ...knowledgeSourcesEntities,
    ...knowledgeSuggestionStateEntities,
    ...mcpCallLogEntities,
    ...mcpConnectorsEntities,
    ...mcpGatewayReceiptsEntities,
    ...mcpToolGrantsEntities,
    ...memberGrantsEntities,
    ...messagesEntities,
    ...metaCommentsEntities,
    ...metaInboxEntities,
    ...metaThreadsEntities,
    ...moduleContextNotesEntities,
    ...moduleContextVersionsEntities,
    ...moduleInstallationsEntities,
    ...moduleSetupMessagesEntities,
    ...moduleSetupSessionsEntities,
    ...moduleSetupWritesEntities,
    ...modulesEntities,
    ...nivoKnowledgeEntities,
    ...officeRoomsEntities,
    ...openclawAgentSyncEntities,
    ...paymentOrderRequestsEntities,
    ...paymentOrdersEntities,
    ...platformAdminEntities,
    ...platformAuditEntities,
    ...publicApiEntities,
    ...publicDocumentsEntities,
    ...sepayTransactionsEntities,
    ...shiftsEntities,
    ...staffEntities,
    ...supplierPayablesEntities,
    ...telegramInboxEntities,
    ...agentTemplatesEntities,
    ...templateMarketplaceEntities,
    ...entityEngineEntities,
    ...agentWorkEntities,
    ...transactionsEntities,
    ...videoBrandKitsEntities,
    ...videoDelegationsEntities,
    ...videoProjectVersionsEntities,
    ...videoProjectsEntities,
    ...videoRendersEntities,
    ...workItemsEntities,
    ...workspaceInvitesEntities,
    ...workspaceMembersEntities,
    ...workspacesEntities,
    ...zaloInboxEntities,
    ...zaloWizardDraftsEntities,
    ...databaseEntities,
    ...inboxEntities,
    ...jobsEntities,
    ...realtimeEntities,
] as const

import { appErrorsEntities } from "@modules/domain/app-errors"
import { agentAccessLogEntities } from "@modules/domain/agent-access-log"
import { agentConnectionsEntities } from "@modules/domain/agent-connections"
import { agentsEntities } from "@modules/domain/agents"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import { agentRunsEntities } from "@modules/domain/agent-runs"
import { graphNodesEntities } from "@modules/domain/graph-nodes"
import { agentThreadsEntities } from "@modules/domain/agent-threads"
import { aiGenerationsEntities } from "@modules/domain/ai-generations"
import { aiQuotaOverridesEntities } from "@modules/domain/ai-quota-overrides"
import { aiUsageEventsEntities } from "@modules/domain/ai-usage-events"
import { apiKeysEntities } from "@modules/domain/api-keys"
import { appCommandsEntities } from "@modules/domain/app-commands"
import { connectionPollEntities } from "@modules/domain/connection-poll"
import { billingEntities } from "@modules/domain/billing"
import { brainEntities } from "@modules/domain/brain"
import { brainCommandsEntities } from "@modules/domain/brain-commands"
import { brainEvalCasesEntities } from "@modules/domain/brain-eval-cases"
import { brainExtractionsEntities } from "@modules/domain/brain-extractions"
import { brainFactsEntities } from "@modules/domain/brain-facts"
import { brainLessonsEntities } from "@modules/domain/brain-lessons"
import { channelConnectionsEntities } from "@modules/domain/channel-connections"
import { teamChatEntities } from "@modules/domain/team-chat"
import { connectionCommandsEntities } from "@modules/domain/connection-commands"
import { connectionSecretsEntities } from "@modules/domain/connection-secrets"
import { connectionsEntities } from "@modules/domain/connections"
import { connectorInterestEntities } from "@modules/domain/connector-interest"
import { creditsEntities } from "@modules/domain/credits"
import { contactsEntities } from "@modules/domain/contacts"
import { accountDataEntities } from "@modules/domain/account-data"
import { dataRecordsEntities } from "@modules/domain/data-records"
import { dataSyncRunsEntities } from "@modules/domain/data-sync-runs"
import { dossierReviewEntities } from "@modules/domain/dossier-review"
import { emailMessagesEntities } from "@modules/domain/email-messages"
import { eventsEntities } from "@modules/domain/events"
import { identityEntities } from "@modules/domain/identity"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { websiteIntakeEntities } from "@modules/domain/inbox-leads"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"
import { knowledgeGapsEntities } from "@modules/domain/knowledge-gaps"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { knowledgeSuggestionStateEntities } from "@modules/domain/knowledge-suggestion-state"
import { customerRoutesEntities } from "@modules/domain/customer-routes"
import { toolCallLogEntities } from "@modules/domain/tool-call-log"
import { toolReceiptsEntities } from "@modules/domain/tool-receipts"
import { toolGrantsEntities } from "@modules/domain/tool-grants"
import { metaCommentsEntities } from "@modules/domain/meta-comments"
import { metaThreadsEntities } from "@modules/domain/meta-threads"
import { moduleContextNotesEntities } from "@modules/domain/module-context-notes"
import { moduleContextVersionsEntities } from "@modules/domain/module-context-versions"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import { moduleSetupMessagesEntities } from "@modules/domain/module-setup-messages"
import { moduleSetupSessionsEntities } from "@modules/domain/module-setup-sessions"
import { moduleSetupWritesEntities } from "@modules/domain/module-setup-writes"
import { modulesEntities } from "@modules/domain/modules"
import { nivoKnowledgeEntities } from "@modules/domain/nivo-knowledge"
import { paymentOrderRequestsEntities } from "@modules/domain/payment-order-requests"
import { paymentOrdersEntities } from "@modules/domain/payment-orders"
import { platformAdminEntities } from "@modules/domain/platform-admin"
import { platformAuditEntities } from "@modules/domain/platform-audit"
import { providerTriggersEntities } from "@modules/domain/provider-triggers"
import { providerSandboxEntities } from "@modules/domain/provider-sandbox"
import { publicApiEntities } from "@modules/domain/public-api"
import { publicDocumentsEntities } from "@modules/domain/public-documents"
import { sepayTransactionsEntities } from "@modules/domain/sepay-transactions"
import { staffEntities } from "@modules/domain/staff"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import { agentWorkEntities } from "@modules/domain/agent-work"
import { agentCheckpointsEntities } from "@modules/domain/agent-checkpoints"
import { workItemsEntities } from "@modules/domain/work-items"
import { workspaceInvitesEntities } from "@modules/domain/workspace-invites"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { vectorSyncEntities } from "@modules/domain/vector-sync"
import { workspacesEntities } from "@modules/domain/workspaces"
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
    ...agentGraphsEntities,
    ...agentRunsEntities,
    ...graphNodesEntities,
    ...agentThreadsEntities,
    ...aiGenerationsEntities,
    ...aiQuotaOverridesEntities,
    ...aiUsageEventsEntities,
    ...apiKeysEntities,
    ...appCommandsEntities,
    ...connectionPollEntities,
    ...billingEntities,
    ...brainEntities,
    ...brainCommandsEntities,
    ...dossierReviewEntities,
    ...brainEvalCasesEntities,
    ...brainExtractionsEntities,
    ...brainFactsEntities,
    ...brainLessonsEntities,
    ...channelConnectionsEntities,
    ...teamChatEntities,
    ...connectionCommandsEntities,
    ...connectionSecretsEntities,
    ...connectionsEntities,
    ...connectorInterestEntities,
    ...creditsEntities,
    ...contactsEntities,
    ...accountDataEntities,
    ...dataRecordsEntities,
    ...dataSyncRunsEntities,
    ...emailMessagesEntities,
    ...eventsEntities,
    ...identityEntities,
    ...inboundEventsEntities,
    ...websiteIntakeEntities,
    ...knowledgeChunksEntities,
    ...knowledgeGapsEntities,
    ...knowledgeSourcesEntities,
    ...knowledgeSuggestionStateEntities,
    ...customerRoutesEntities,
    ...toolCallLogEntities,
    ...toolReceiptsEntities,
    ...toolGrantsEntities,
    ...metaCommentsEntities,
    ...metaThreadsEntities,
    ...moduleContextNotesEntities,
    ...moduleContextVersionsEntities,
    ...moduleInstallationsEntities,
    ...moduleSetupMessagesEntities,
    ...moduleSetupSessionsEntities,
    ...moduleSetupWritesEntities,
    ...modulesEntities,
    ...nivoKnowledgeEntities,
    ...paymentOrderRequestsEntities,
    ...paymentOrdersEntities,
    ...platformAdminEntities,
    ...platformAuditEntities,
    ...providerTriggersEntities,
    ...providerSandboxEntities,
    ...publicApiEntities,
    ...publicDocumentsEntities,
    ...sepayTransactionsEntities,
    ...staffEntities,
    ...entityEngineEntities,
    ...agentWorkEntities,
    ...agentCheckpointsEntities,
    ...workItemsEntities,
    ...workspaceInvitesEntities,
    ...workspaceMembersEntities,
    ...vectorSyncEntities,
    ...workspacesEntities,
    ...zaloWizardDraftsEntities,
    ...databaseEntities,
    ...inboxEntities,
    ...jobsEntities,
    ...realtimeEntities,
] as const

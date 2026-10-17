import { AUTOMATIONS_ERROR_KINDS } from "@modules/domain/automations"
import { DECISIONS_ERROR_KINDS } from "@modules/domain/decisions"
import { FLOW_ENGINE_ERROR_KINDS } from "@modules/domain/flow-engine"
import { CONNECTIONS_ERROR_KINDS } from "@modules/domain/connections"
import { DATA_HUB_ERROR_KINDS } from "@modules/domain/data-hub"
import { DATA_SOURCES_ERROR_KINDS } from "@modules/integrations/data-sources"
import { CHATREPLY_ERROR_KINDS } from "@modules/domain/chatreply"
import { CONNECTION_GRANTS_ERROR_KINDS } from "@modules/domain/connection-grants"
import { CHANNEL_CONNECTIONS_ERROR_KINDS } from "@modules/domain/channel-connections"
import { WEBHOOK_CONNECTIONS_ERROR_KINDS } from "@modules/domain/webhook-connections"
import { GOOGLE_CONNECTIONS_ERROR_KINDS } from "@modules/domain/google-connections"
import { META_CONNECTIONS_ERROR_KINDS } from "@modules/domain/meta-connections"
import { META_INBOX_ERROR_KINDS } from "@modules/domain/meta-inbox"
import { GOOGLE_ERROR_KINDS } from "@modules/integrations/google"
import { META_ERROR_KINDS } from "@modules/integrations/meta"
import { CHANNEL_SETUP_ERROR_KINDS } from "@modules/integrations/channel-setup"
import { WEBHOOK_DELIVERY_ERROR_KINDS } from "@modules/integrations/webhook-delivery"
import { HTTP_ERROR_KINDS } from "@modules/platform/http"
import { JOB_OPS_ERROR_KINDS } from "@modules/domain/job-ops"
import { AUTOMATION_PIPELINES_ERROR_KINDS } from "@modules/domain/automation-pipelines"
import { AUTOMATION_TEMPLATES_ERROR_KINDS } from "@modules/domain/automation-templates"
import { AGENT_CONNECTIONS_ERROR_KINDS } from "@modules/domain/agent-connections"
import { AGENT_TOOLS_ERROR_KINDS } from "@modules/domain/agent-tools"
import { AGENTS_ERROR_KINDS } from "@modules/domain/agents"
import { AI_GENERATIONS_ERROR_KINDS } from "@modules/domain/ai-generations"
import { EMAIL_MESSAGES_ERROR_KINDS } from "@modules/domain/email-messages"
import { INVOICES_ERROR_KINDS } from "@modules/domain/invoices"
import { ORDERS_ERROR_KINDS } from "@modules/domain/orders"
import { TRANSACTIONS_ERROR_KINDS } from "@modules/domain/transactions"
import { WORK_PERFORMERS_ERROR_KINDS } from "@modules/domain/work-performers"
import { API_KEYS_ERROR_KINDS } from "@modules/domain/api-keys"
import { AUTHORITY_ERROR_KINDS } from "@modules/domain/authority"

/** App-wide errors catalog, preserving registration order. */
export const API_ERROR_KINDS_1 = [
    CONNECTIONS_ERROR_KINDS,
    DATA_HUB_ERROR_KINDS,
    DATA_SOURCES_ERROR_KINDS,
    CHATREPLY_ERROR_KINDS,
    CONNECTION_GRANTS_ERROR_KINDS,
    CHANNEL_CONNECTIONS_ERROR_KINDS,
    WEBHOOK_CONNECTIONS_ERROR_KINDS,
    GOOGLE_CONNECTIONS_ERROR_KINDS,
    META_CONNECTIONS_ERROR_KINDS,
    META_INBOX_ERROR_KINDS,
    GOOGLE_ERROR_KINDS,
    META_ERROR_KINDS,
    CHANNEL_SETUP_ERROR_KINDS,
    WEBHOOK_DELIVERY_ERROR_KINDS,
    HTTP_ERROR_KINDS,
    JOB_OPS_ERROR_KINDS,
    AUTOMATION_PIPELINES_ERROR_KINDS,
    AUTOMATION_TEMPLATES_ERROR_KINDS,
    AUTOMATIONS_ERROR_KINDS,
    DECISIONS_ERROR_KINDS,
    FLOW_ENGINE_ERROR_KINDS,
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_TOOLS_ERROR_KINDS,
    AGENTS_ERROR_KINDS,
    AI_GENERATIONS_ERROR_KINDS,
    EMAIL_MESSAGES_ERROR_KINDS,
    INVOICES_ERROR_KINDS,
    ORDERS_ERROR_KINDS,
    TRANSACTIONS_ERROR_KINDS,
    WORK_PERFORMERS_ERROR_KINDS,
    API_KEYS_ERROR_KINDS,
    AUTHORITY_ERROR_KINDS,
]

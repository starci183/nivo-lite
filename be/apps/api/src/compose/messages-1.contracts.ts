import { AUTOMATIONS_MESSAGES } from "@modules/domain/automations"
import { DECISIONS_MESSAGES } from "@modules/domain/decisions"
import { AUTOMATION_PORTS_MESSAGES } from "@modules/domain/automation-ports"
import { BOOKING_PORTS_MESSAGES } from "@modules/domain/booking-ports"
import { FLOW_ENGINE_MESSAGES } from "@modules/domain/flow-engine"
import { DOCUMENTS_MESSAGES } from "@modules/integrations/documents"
import { CHATREPLY_MESSAGES } from "@modules/domain/chatreply"
import { CONNECTIONS_MESSAGES } from "@modules/domain/connections"
import { DATA_HUB_MESSAGES } from "@modules/domain/data-hub"
import { CONNECTION_GRANTS_MESSAGES } from "@modules/domain/connection-grants"
import { CHANNEL_CONNECTIONS_MESSAGES } from "@modules/domain/channel-connections"
import { WEBHOOK_CONNECTIONS_MESSAGES } from "@modules/domain/webhook-connections"
import { GOOGLE_CONNECTIONS_MESSAGES } from "@modules/domain/google-connections"
import { META_CONNECTIONS_MESSAGES } from "@modules/domain/meta-connections"
import { META_INBOX_MESSAGES } from "@modules/domain/meta-inbox"
import { GOOGLE_MESSAGES } from "@modules/integrations/google"
import { META_MESSAGES } from "@modules/integrations/meta"
import { CHANNEL_SETUP_MESSAGES } from "@modules/integrations/channel-setup"
import { WEBHOOK_DELIVERY_MESSAGES } from "@modules/integrations/webhook-delivery"
import { HTTP_MESSAGES } from "@modules/platform/http"
import { AUTOMATION_PIPELINES_MESSAGES } from "@modules/domain/automation-pipelines"
import { AUTOMATION_RUNS_MESSAGES } from "@modules/domain/automation-runs"
import { AUTOMATION_TEMPLATES_MESSAGES } from "@modules/domain/automation-templates"
import { AGENT_CONNECTIONS_MESSAGES } from "@modules/domain/agent-connections"
import { AGENT_TOOLS_MESSAGES } from "@modules/domain/agent-tools"
import { AGENTS_MESSAGES } from "@modules/domain/agents"
import { AI_GENERATIONS_MESSAGES } from "@modules/domain/ai-generations"
import { AI_USAGE_EVENTS_MESSAGES } from "@modules/domain/ai-usage-events"
import { EMAIL_MESSAGES_MESSAGES } from "@modules/domain/email-messages"
import { INVOICES_MESSAGES } from "@modules/domain/invoices"
import { ORDERS_MESSAGES } from "@modules/domain/orders"
import { TRANSACTIONS_MESSAGES } from "@modules/domain/transactions"
import { WORK_PERFORMERS_MESSAGES } from "@modules/domain/work-performers"
import { API_KEYS_MESSAGES } from "@modules/domain/api-keys"

/** App-wide messages catalog, preserving registration order. */
export const API_MESSAGES_1 = [
    DOCUMENTS_MESSAGES,
    CHATREPLY_MESSAGES,
    CONNECTIONS_MESSAGES,
    DATA_HUB_MESSAGES,
    CONNECTION_GRANTS_MESSAGES,
    CHANNEL_CONNECTIONS_MESSAGES,
    WEBHOOK_CONNECTIONS_MESSAGES,
    GOOGLE_CONNECTIONS_MESSAGES,
    META_CONNECTIONS_MESSAGES,
    META_INBOX_MESSAGES,
    GOOGLE_MESSAGES,
    META_MESSAGES,
    CHANNEL_SETUP_MESSAGES,
    WEBHOOK_DELIVERY_MESSAGES,
    HTTP_MESSAGES,
    AUTOMATION_PIPELINES_MESSAGES,
    AUTOMATION_RUNS_MESSAGES,
    AUTOMATION_TEMPLATES_MESSAGES,
    AUTOMATIONS_MESSAGES,
    DECISIONS_MESSAGES,
    AUTOMATION_PORTS_MESSAGES,
    BOOKING_PORTS_MESSAGES,
    FLOW_ENGINE_MESSAGES,
    AGENT_CONNECTIONS_MESSAGES,
    AGENT_TOOLS_MESSAGES,
    AGENTS_MESSAGES,
    AI_GENERATIONS_MESSAGES,
    AI_USAGE_EVENTS_MESSAGES,
    EMAIL_MESSAGES_MESSAGES,
    INVOICES_MESSAGES,
    ORDERS_MESSAGES,
    TRANSACTIONS_MESSAGES,
    WORK_PERFORMERS_MESSAGES,
    API_KEYS_MESSAGES,
]

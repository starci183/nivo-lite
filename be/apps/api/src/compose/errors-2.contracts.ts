import { APPROVAL_REQUESTS_ERROR_KINDS } from "@modules/domain/approval-requests"
import { AUTHORITY_RULES_ERROR_KINDS } from "@modules/domain/authority-rules"
import { MEMBER_GRANTS_ERROR_KINDS } from "@modules/domain/member-grants"
import { AI_TASKS_ERROR_KINDS } from "@modules/domain/ai-tasks"
import { EXECUTIONS_ERROR_KINDS } from "@modules/domain/executions"
import { OFFICE_COMMAND_CANDIDATES_ERROR_KINDS } from "@modules/domain/office-command-candidates"
import { OPENCLAW_AGENT_SYNC_ERROR_KINDS } from "@modules/domain/openclaw-agent-sync"
import { OPENCLAW_ERROR_KINDS } from "@modules/integrations/openclaw"
import { RESPONSIBILITIES_ERROR_KINDS } from "@modules/domain/responsibilities"
import { WORK_ITEMS_ERROR_KINDS } from "@modules/domain/work-items"
import { STAFF_ERROR_KINDS } from "@modules/domain/staff"
import { AGENT_CONVERSATIONS_ERROR_KINDS } from "@modules/domain/agent-conversations"
import { AGENT_MESSAGES_ERROR_KINDS } from "@modules/domain/agent-messages"
import { BILLING_ERROR_KINDS } from "@modules/domain/billing"
import { LEAD_ACTIONS_ERROR_KINDS } from "@modules/domain/lead-actions"
import { AGENT_CHAT_ERROR_KINDS } from "@modules/domain/agent-chat"
import { ACCOUNTING_ERROR_KINDS } from "@modules/domain/accounting"
import { ACCOUNTING_ADJUSTMENTS_ERROR_KINDS } from "@modules/domain/accounting-adjustments"
import { PAYMENT_ORDER_REQUESTS_ERROR_KINDS } from "@modules/domain/payment-order-requests"
import { CREDITS_ERROR_KINDS } from "@modules/domain/credits"
import { INBOUND_EVENTS_ERROR_KINDS } from "@modules/domain/inbound-events"
import { PAYMENT_ORDERS_ERROR_KINDS } from "@modules/domain/payment-orders"
import { CHANNELS_ERROR_KINDS } from "@modules/domain/channels"
import { CONNECTION_SECRETS_ERROR_KINDS } from "@modules/domain/connection-secrets"
import { CONVERSATIONS_ERROR_KINDS } from "@modules/domain/conversations"
import { MAIL_ERROR_KINDS } from "@modules/integrations/mail"
import { TELEGRAM_ERROR_KINDS } from "@modules/integrations/telegram"
import { ZALO_ERROR_KINDS } from "@modules/integrations/zalo"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { DATABASE_ERROR_KINDS } from "@modules/platform/database"
import { DOCUMENTS_ERROR_KINDS } from "@modules/integrations/documents"
import { HTTP_SECURITY_ERROR_KINDS } from "@modules/platform/http-security"

/** App-wide errors catalog, preserving registration order. */
export const API_ERROR_KINDS_2 = [
    AUTHORITY_RULES_ERROR_KINDS,
    MEMBER_GRANTS_ERROR_KINDS,
    APPROVAL_REQUESTS_ERROR_KINDS,
    AI_TASKS_ERROR_KINDS,
    EXECUTIONS_ERROR_KINDS,
    OFFICE_COMMAND_CANDIDATES_ERROR_KINDS,
    OPENCLAW_AGENT_SYNC_ERROR_KINDS,
    OPENCLAW_ERROR_KINDS,
    RESPONSIBILITIES_ERROR_KINDS,
    WORK_ITEMS_ERROR_KINDS,
    STAFF_ERROR_KINDS,
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AGENT_MESSAGES_ERROR_KINDS,
    BILLING_ERROR_KINDS,
    LEAD_ACTIONS_ERROR_KINDS,
    AGENT_CHAT_ERROR_KINDS,
    ACCOUNTING_ERROR_KINDS,
    ACCOUNTING_ADJUSTMENTS_ERROR_KINDS,
    PAYMENT_ORDER_REQUESTS_ERROR_KINDS,
    CREDITS_ERROR_KINDS,
    INBOUND_EVENTS_ERROR_KINDS,
    PAYMENT_ORDERS_ERROR_KINDS,
    CHANNELS_ERROR_KINDS,
    CONNECTION_SECRETS_ERROR_KINDS,
    CONVERSATIONS_ERROR_KINDS,
    MAIL_ERROR_KINDS,
    TELEGRAM_ERROR_KINDS,
    ZALO_ERROR_KINDS,
    CONFIG_ERROR_KINDS,
    DATABASE_ERROR_KINDS,
    DOCUMENTS_ERROR_KINDS,
    HTTP_SECURITY_ERROR_KINDS,
]

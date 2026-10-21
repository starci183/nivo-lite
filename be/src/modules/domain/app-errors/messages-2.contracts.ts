import { AUTHORITY_MESSAGES } from "@modules/domain/authority"
import { AUTHORITY_RULES_MESSAGES } from "@modules/domain/authority-rules"
import { DEEPSEEK_MESSAGES } from "@modules/integrations/deepseek"
import { EXECUTIONS_MESSAGES } from "@modules/domain/executions"
import { OFFICE_COMMAND_CANDIDATES_MESSAGES } from "@modules/domain/office-command-candidates"
import { OPENCLAW_AGENT_SYNC_MESSAGES } from "@modules/domain/openclaw-agent-sync"
import { OPENCLAW_MESSAGES } from "@modules/integrations/openclaw"
import { RESPONSIBILITY_JOURNAL_MESSAGES } from "@modules/domain/responsibilities"
import { WORK_ITEMS_MESSAGES } from "@modules/domain/work-items"
import { STAFF_MESSAGES } from "@modules/domain/staff"
import { AGENT_CONVERSATIONS_MESSAGES } from "@modules/domain/agent-conversations"
import { AGENT_MESSAGES_MESSAGES } from "@modules/domain/agent-messages"
import { BILLING_MESSAGES } from "@modules/domain/billing"
import { LEAD_ACTIONS_MESSAGES } from "@modules/domain/lead-actions"
import { AGENT_CHAT_MESSAGES } from "@modules/domain/agent-chat"
import { ACCOUNTING_MESSAGES } from "@modules/domain/accounting"
import { ACCOUNTING_ADJUSTMENTS_MESSAGES } from "@modules/domain/accounting-adjustments"
import { PAYMENT_ORDER_REQUESTS_MESSAGES } from "@modules/domain/payment-order-requests"
import { CREDITS_MESSAGES } from "@modules/domain/credits"
import { INBOUND_EVENTS_MESSAGES } from "@modules/domain/inbound-events"
import { PAYMENT_ORDERS_MESSAGES } from "@modules/domain/payment-orders"
import { CHANNELS_MESSAGES } from "@modules/domain/channels"
import { CONNECTION_SECRETS_MESSAGES } from "@modules/domain/connection-secrets"
import { CONVERSATIONS_MESSAGES } from "@modules/domain/conversations"
import { CUSTOMER_TURNS_MESSAGES } from "@modules/domain/customer-turns"
import { MAIL_MESSAGES } from "@modules/integrations/mail"
import { TELEGRAM_MESSAGES } from "@modules/integrations/telegram"
import { ZALO_MESSAGES } from "@modules/integrations/zalo"
import { ERRORS_MESSAGES } from "@modules/platform/errors"
import { HTTP_SECURITY_MESSAGES } from "@modules/platform/http-security"

/** App-wide messages catalog, preserving registration order. */
export const API_MESSAGES_2 = [
    AUTHORITY_MESSAGES,
    AUTHORITY_RULES_MESSAGES,
    DEEPSEEK_MESSAGES,
    EXECUTIONS_MESSAGES,
    OFFICE_COMMAND_CANDIDATES_MESSAGES,
    OPENCLAW_AGENT_SYNC_MESSAGES,
    OPENCLAW_MESSAGES,
    RESPONSIBILITY_JOURNAL_MESSAGES,
    WORK_ITEMS_MESSAGES,
    STAFF_MESSAGES,
    AGENT_CONVERSATIONS_MESSAGES,
    AGENT_MESSAGES_MESSAGES,
    BILLING_MESSAGES,
    LEAD_ACTIONS_MESSAGES,
    AGENT_CHAT_MESSAGES,
    ACCOUNTING_MESSAGES,
    ACCOUNTING_ADJUSTMENTS_MESSAGES,
    PAYMENT_ORDER_REQUESTS_MESSAGES,
    CREDITS_MESSAGES,
    INBOUND_EVENTS_MESSAGES,
    PAYMENT_ORDERS_MESSAGES,
    CHANNELS_MESSAGES,
    CONNECTION_SECRETS_MESSAGES,
    CONVERSATIONS_MESSAGES,
    CUSTOMER_TURNS_MESSAGES,
    MAIL_MESSAGES,
    TELEGRAM_MESSAGES,
    ZALO_MESSAGES,
    ERRORS_MESSAGES,
    HTTP_SECURITY_MESSAGES,
]

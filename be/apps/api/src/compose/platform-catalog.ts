import { ERRORS_MESSAGES } from "@modules/platform/errors"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES } from "@modules/platform/http-security"
import { DATABASE_ERROR_KINDS } from "@modules/platform/database"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES } from "@modules/platform/event-bus"
import { QUEUE_ERROR_KINDS, QUEUE_MESSAGES } from "@modules/platform/queue"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES } from "@modules/platform/jobs"
import { ENTITY_PLANNER_ERROR_KINDS } from "@modules/domain/entity-planner"
import { JOB_OPS_ERROR_KINDS } from "@modules/domain/job-ops"
import { FLOW_ENGINE_ERROR_KINDS, FLOW_ENGINE_MESSAGES } from "@modules/domain/flow-engine"
import { AUTHORITY_ERROR_KINDS, AUTHORITY_MESSAGES } from "@modules/domain/authority"
import { AUTHORITY_RULES_ERROR_KINDS, AUTHORITY_RULES_MESSAGES } from "@modules/domain/authority-rules"
import { MEMBER_GRANTS_ERROR_KINDS, MEMBER_GRANTS_MESSAGES } from "@modules/domain/member-grants"
import { WORK_ITEMS_ERROR_KINDS, WORK_ITEMS_MESSAGES } from "@modules/domain/work-items"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { API_ERROR_KINDS, EVENTS_MESSAGES } from "@modules/events/api"
import { MCP_ERROR_KINDS, MCP_MESSAGES } from "@modules/integrations/mcp"
import { MCP_GATEWAY_RECEIPTS_ERROR_KINDS, MCP_GATEWAY_RECEIPTS_MESSAGES } from "@modules/domain/mcp-gateway-receipts"
import { BOOKING_PORTS_MESSAGES } from "@modules/domain/booking-ports"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"

/** The error kinds of the capabilities this group registers, in registration order. */
export const platformErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    JOB_OPS_ERROR_KINDS,
    ENTITY_PLANNER_ERROR_KINDS,
    FLOW_ENGINE_ERROR_KINDS,
    AUTHORITY_ERROR_KINDS,
    AUTHORITY_RULES_ERROR_KINDS,
    MEMBER_GRANTS_ERROR_KINDS,
    WORK_ITEMS_ERROR_KINDS,
    CONFIG_ERROR_KINDS,
    DATABASE_ERROR_KINDS,
    HTTP_SECURITY_ERROR_KINDS,
    API_ERROR_KINDS,
    EVENT_BUS_ERROR_KINDS,
    JOBS_ERROR_KINDS,
    QUEUE_ERROR_KINDS,
    MCP_ERROR_KINDS,
    MCP_GATEWAY_RECEIPTS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const platformMessages: ReadonlyArray<MessageBundle> = [
    BOOKING_PORTS_MESSAGES,
    FLOW_ENGINE_MESSAGES,
    EVENTS_MESSAGES,
    EVENT_BUS_MESSAGES,
    AUTHORITY_MESSAGES,
    AUTHORITY_RULES_MESSAGES,
    MEMBER_GRANTS_MESSAGES,
    WORK_ITEMS_MESSAGES,
    ERRORS_MESSAGES,
    HTTP_SECURITY_MESSAGES,
    JOBS_MESSAGES,
    QUEUE_MESSAGES,
    MCP_MESSAGES,
    MCP_GATEWAY_RECEIPTS_MESSAGES,
]

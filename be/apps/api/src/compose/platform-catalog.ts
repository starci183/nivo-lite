import { ERRORS_MESSAGES, type ErrorKind } from "@modules/platform/errors"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES } from "@modules/platform/http-security"
import { DATABASE_ERROR_KINDS } from "@modules/platform/database"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES } from "@modules/platform/event-bus"
import { QUEUE_ERROR_KINDS, QUEUE_MESSAGES } from "@modules/platform/queue"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES } from "@modules/platform/jobs"
import { ENTITY_PLANNER_ERROR_KINDS } from "@modules/domain/entity-planner"
import { JOB_OPS_ERROR_KINDS } from "@modules/domain/job-ops"
import { WORK_ITEMS_ERROR_KINDS, WORK_ITEMS_MESSAGES } from "@modules/domain/work-items"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { API_ERROR_KINDS, EVENTS_MESSAGES } from "@modules/events/api"
import { TOOL_RECEIPTS_ERROR_KINDS, TOOL_RECEIPTS_MESSAGES } from "@modules/domain/tool-receipts"
import type { MessageBundle } from "@modules/platform/i18n"

/** The error kinds of the capabilities this group registers, in registration order. */
export const platformErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    JOB_OPS_ERROR_KINDS,
    ENTITY_PLANNER_ERROR_KINDS,
    WORK_ITEMS_ERROR_KINDS,
    CONFIG_ERROR_KINDS,
    DATABASE_ERROR_KINDS,
    HTTP_SECURITY_ERROR_KINDS,
    API_ERROR_KINDS,
    EVENT_BUS_ERROR_KINDS,
    JOBS_ERROR_KINDS,
    QUEUE_ERROR_KINDS,
    TOOL_RECEIPTS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const platformMessages: ReadonlyArray<MessageBundle> = [
    EVENTS_MESSAGES,
    EVENT_BUS_MESSAGES,
    WORK_ITEMS_MESSAGES,
    ERRORS_MESSAGES,
    HTTP_SECURITY_MESSAGES,
    JOBS_MESSAGES,
    QUEUE_MESSAGES,
    TOOL_RECEIPTS_MESSAGES,
]

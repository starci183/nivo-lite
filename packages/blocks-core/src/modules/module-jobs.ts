import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { ACCOUNTING_JOBS } from "./sales/ledger"
import { DELIVER_REPLY } from "./chatbot/jobs/deliver-reply.job"
import { PLATFORM_JOBS } from "./platform/jobs/team-chat.jobs"

/**
 * The declared jobs of every module whose business runs in this package, the list the back end's job runner looks a delivery of the
 * module-jobs queue up in (a job is enqueued through the outbox by its name). Each move adds its module's jobs here.
 */
export const MODULE_JOBS: ReadonlyArray<JobDefinition> = [DELIVER_REPLY, ...ACCOUNTING_JOBS, ...PLATFORM_JOBS]

import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { bookProjectJob } from "./jobs/book-project.job"
import { confirmNoticeJob } from "./jobs/confirm-notice.job"
import { ledgerAppendJob } from "./jobs/ledger-append.job"

/** The declared jobs of the Accounting and payment modules: the ledger line, the book entry and the notice to the customer. */
export const ACCOUNTING_JOBS: ReadonlyArray<JobDefinition> = [ledgerAppendJob, bookProjectJob, confirmNoticeJob]

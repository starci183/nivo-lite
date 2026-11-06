import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { bookProjectJob } from "./jobs/book-project.job"
import { confirmNoticeJob } from "./jobs/confirm-notice.job"
import { ledgerAppendJob } from "./jobs/ledger-append.job"
import { rematchJob } from "./jobs/rematch.job"

/** The declared jobs of the Accounting and payment modules: the ledger line, the book entry, the notice to the customer and the re-match of a credit that arrived before its payment code. */
export const ACCOUNTING_JOBS: ReadonlyArray<JobDefinition> = [
    ledgerAppendJob,
    bookProjectJob,
    confirmNoticeJob,
    rematchJob,
]

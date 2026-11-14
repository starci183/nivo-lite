import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { bookProjectJob } from "./jobs/book-project.job"
import { ledgerAppendJob } from "./jobs/ledger-append.job"

/** The declared jobs of the Accounting and payment modules: the ledger line and the book entry. */
export const ACCOUNTING_JOBS: ReadonlyArray<JobDefinition> = [
    ledgerAppendJob,
    bookProjectJob,
]

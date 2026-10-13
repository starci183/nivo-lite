import type { N8nWorkflowFile } from "./n8n-host.contracts"
import { WORKFLOW_EMAIL_DAILY_REPORT } from "./email-daily-report.templates"
import { WORKFLOW_EMAIL_DEBT_REMINDER } from "./email-debt-reminder.templates"
import { WORKFLOW_EMAIL_MONTH_LEDGER } from "./email-month-ledger.templates"
import { WORKFLOW_EMAIL_PAYMENT_RECEIPT } from "./email-payment-receipt.templates"

/** The shared n8n workflows pushed into the container, in file-name order. */
export const N8N_WORKFLOWS: ReadonlyArray<N8nWorkflowFile> = [
    WORKFLOW_EMAIL_DAILY_REPORT,
    WORKFLOW_EMAIL_DEBT_REMINDER,
    WORKFLOW_EMAIL_MONTH_LEDGER,
    WORKFLOW_EMAIL_PAYMENT_RECEIPT,
]

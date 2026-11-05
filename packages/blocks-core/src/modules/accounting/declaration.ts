import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { adjustAction } from "./actions/adjust.action"
import { saveSettingsAction } from "./actions/save-settings.action"
import { settleAction } from "./actions/settle.action"
import { closeCheckRead } from "./reads/close-check.read"
import { entriesRead, entryCountsRead } from "./reads/entries.read"
import { entryRead } from "./reads/entry.read"
import { figuresRead } from "./reads/figures.read"
import { settingsRead } from "./reads/settings.read"
import { accountingSpecDocument } from "./specs/accounting.spec-document"

/**
 * The Accounting module: the books (figures, the entries with search and a kind filter, an entry's lineage), the correction an
 * accountant records, and the check that a period may close. What becomes an entry (expenses, outgoing invoices, unmatched money,
 * voided invoices) is the workspace's own setting, edited in the settings view. Its seed spec draws the workbench; the graph and the jobs run the same
 * reads and actions.
 */
export const accountingModule: ModuleDeclaration = defineModule({
    key: "accounting",
    namespace: "accounting",
    permissions: ["accounting.view", "accounting.manage"],
    reads: [entriesRead, entryCountsRead, entryRead, figuresRead, closeCheckRead, settingsRead],
    actions: [adjustAction, saveSettingsAction],
    tools: ["ledger.status", "ledger.append"],
    specs: [accountingSpecDocument],
})

/**
 * The payment module: `payment.settle`, the transactional action that ties a bank transaction to the order (and the claim) it paid.
 * It has no screen and no read: the graph runs it from the `payment.settle` node, and its outbox jobs (`accounting.ledger-append`,
 * `accounting.book-project`, `payment.confirm-notice`) do the outside work. Its words are the Accounting module's (namespace `accounting`).
 */
export const paymentModule: ModuleDeclaration = defineModule({
    key: "payment",
    namespace: "accounting",
    permissions: ["payment.manage"],
    reads: [],
    actions: [settleAction],
    tools: ["chat.send"],
    specs: [],
})

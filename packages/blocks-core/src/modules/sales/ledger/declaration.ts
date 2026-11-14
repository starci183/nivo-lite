import type { ActionDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { type BilingualText, bilingualOf } from "../../../messages/catalog"
import { TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import { answerQuestionAction } from "./actions/answer-question.action"
import { adjustAction } from "./actions/adjust.action"
import { decideOwnerItemAction } from "./actions/decide-owner-item.action"
import { resolveUnmatchedPaymentAction } from "./actions/resolve-unmatched-payment.action"
import { saveSettingsAction } from "./actions/save-settings.action"
import { repostLedgerAction } from "./actions/repost-ledger.action"
import { settleAction } from "./actions/settle.action"
import { closeCheckRead } from "./reads/close-check.read"
import { decisionsRead } from "./reads/decisions.read"
import { openOrdersRead } from "./reads/open-orders.read"
import { entriesRead, entryCountsRead, entryStatusCountsRead } from "./reads/entries.read"
import { dueSoonRead } from "./reads/due-soon.read"
import { entryRead } from "./reads/entry.read"
import { figuresRead } from "./reads/figures.read"
import { ledgerRead } from "./reads/ledger.read"
import { settingsRead } from "./reads/settings.read"
import { questionCountRead, questionsRead } from "./reads/questions.read"
import { recentRead } from "./reads/recent.read"
import { ownerQueueRead } from "./reads/owner-queue.read"
import { todayRead } from "./reads/today.read"
import { weeklyRead } from "./reads/weekly.read"

/**
 * The books of the sale (the ledger area of the Sales module): the figures, the entries with search and a kind filter, an entry's lineage,
 * the correction an accountant records, the check that a period may close, and the settlement of a payment. What becomes an entry is the
 * workspace's own setting. The Sales module declares these beside its own; its workbench draws them as views of the Sales agent.
 */

/** The tools the ledger's steps call (the agent's reach). */
export const LEDGER_AGENT_TOOLS: ReadonlyArray<ToolId> = [
            TOOL.leadOrderList,
            TOOL.paymentClaimList,
            TOOL.orderOpenList,
            TOOL.orderGet,
            TOOL.customerMessageSend,
            TOOL.teamMessagePost,
            TOOL.agentTag,
            TOOL.ledgerEntryAppend,
            TOOL.brainChangePropose,
        
]

/** The ledger's reads. */
export const LEDGER_READS: ReadonlyArray<ReadDefinition> = [
        entriesRead,
        entryCountsRead,
        entryStatusCountsRead,
        entryRead,
        figuresRead,
        ledgerRead,
        dueSoonRead,
        weeklyRead,
        decisionsRead,
        ownerQueueRead,
        recentRead,
        todayRead,
        openOrdersRead,
        questionCountRead,
        questionsRead,
        closeCheckRead,
        settingsRead,
    
]

/** The ledger's actions. */
export const LEDGER_ACTIONS: ReadonlyArray<ActionDefinition> = [
        adjustAction,
        saveSettingsAction,
        answerQuestionAction,
        resolveUnmatchedPaymentAction,
        decideOwnerItemAction,
        repostLedgerAction,
        settleAction,
    
]

/** The door tools the ledger's actions and jobs call. */
export const LEDGER_TOOLS: ReadonlyArray<ToolId> = [TOOL.ledgerStatusGet, TOOL.ledgerEntryAppend]

/** The guidance the ledger adds to the Sales agent's craft (`sales/craft.ts`). */
export const LEDGER_GUIDANCE: BilingualText = bilingualOf("policyAccountingGuidance")

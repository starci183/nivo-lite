import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { accountingAgeingBlock } from "./ageing.block"
import { accountingBookBlock } from "./book.block"
import { accountingDueSoonBlock } from "./due-soon.block"
import { accountingEntryDetailBlock } from "./entry-detail.block"
import { accountingLedgerBlock } from "./ledger.block"
import { accountingPeriodFiguresBlock } from "./period-figures.block"
import { accountingQuestionsBlock } from "./questions.block"
import { accountingWeeklyBlock } from "./weekly.block"

/** The blocks of the Accounting module: the overview (figures, due dates), the entries, the cash book, the detail of an entry and the questions. */
export const accountingBlocks: ReadonlyArray<BlockDefinition> = [
    accountingPeriodFiguresBlock,
    accountingDueSoonBlock,
    accountingWeeklyBlock,
    accountingAgeingBlock,
    accountingBookBlock,
    accountingLedgerBlock,
    accountingEntryDetailBlock,
    accountingQuestionsBlock,
]

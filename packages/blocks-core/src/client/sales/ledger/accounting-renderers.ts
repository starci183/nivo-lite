import { defineRenderer, type BlockRenderer } from "@nivo-lite/agent-sdk/client"
import { accountingAgeingBlock } from "../../../blocks/sales/ledger/ageing.block"
import { accountingBookBlock } from "../../../blocks/sales/ledger/book.block"
import { accountingDueSoonBlock } from "../../../blocks/sales/ledger/due-soon.block"
import { accountingEntryDetailBlock } from "../../../blocks/sales/ledger/entry-detail.block"
import { accountingLedgerBlock } from "../../../blocks/sales/ledger/ledger.block"
import { accountingPeriodFiguresBlock } from "../../../blocks/sales/ledger/period-figures.block"
import { accountingQuestionsBlock } from "../../../blocks/sales/ledger/questions.block"
import { accountingWeeklyBlock } from "../../../blocks/sales/ledger/weekly.block"
import { AgeingBlock } from "./AgeingBlock"
import { BookBlock } from "./BookBlock"
import { DueSoonBlock } from "./DueSoonBlock"
import { EntryDetailBlock } from "./EntryDetailBlock"
import { LedgerBlock } from "./LedgerBlock"
import { PeriodFiguresBlock } from "./PeriodFiguresBlock"
import { QuestionsBlock } from "./QuestionsBlock"
import { WeeklyBlock } from "./WeeklyBlock"

/** The components of the Accounting blocks, one per definition of `accountingBlocks`. */
export const accountingRenderers: ReadonlyArray<BlockRenderer> = [
    defineRenderer(accountingPeriodFiguresBlock, PeriodFiguresBlock),
    defineRenderer(accountingDueSoonBlock, DueSoonBlock),
    defineRenderer(accountingWeeklyBlock, WeeklyBlock),
    defineRenderer(accountingAgeingBlock, AgeingBlock),
    defineRenderer(accountingBookBlock, BookBlock),
    defineRenderer(accountingLedgerBlock, LedgerBlock),
    defineRenderer(accountingEntryDetailBlock, EntryDetailBlock),
    defineRenderer(accountingQuestionsBlock, QuestionsBlock),
]

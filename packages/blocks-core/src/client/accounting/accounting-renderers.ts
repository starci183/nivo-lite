import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import { accountingAgeingBlock } from "../../blocks/accounting/ageing.block"
import { accountingBookBlock } from "../../blocks/accounting/book.block"
import { accountingDueSoonBlock } from "../../blocks/accounting/due-soon.block"
import { accountingEntryDetailBlock } from "../../blocks/accounting/entry-detail.block"
import { accountingLedgerBlock } from "../../blocks/accounting/ledger.block"
import { accountingPeriodFiguresBlock } from "../../blocks/accounting/period-figures.block"
import { accountingQuestionsBlock } from "../../blocks/accounting/questions.block"
import { accountingWeeklyBlock } from "../../blocks/accounting/weekly.block"
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

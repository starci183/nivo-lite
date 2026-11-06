import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import { accountingBookBlock } from "../../blocks/accounting/book.block"
import { accountingEntryDetailBlock } from "../../blocks/accounting/entry-detail.block"
import { accountingQuestionsBlock } from "../../blocks/accounting/questions.block"
import { BookBlock } from "./BookBlock"
import { EntryDetailBlock } from "./EntryDetailBlock"
import { QuestionsBlock } from "./QuestionsBlock"

/** The components of the Accounting blocks, one per definition of `accountingBlocks`. */
export const accountingRenderers: ReadonlyArray<BlockRenderer> = [
    defineRenderer(accountingBookBlock, BookBlock),
    defineRenderer(accountingEntryDetailBlock, EntryDetailBlock),
    defineRenderer(accountingQuestionsBlock, QuestionsBlock),
]

import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { accountingBookBlock } from "./book.block"
import { accountingEntryDetailBlock } from "./entry-detail.block"
import { accountingQuestionsBlock } from "./questions.block"

/** The blocks of the Accounting module: the book, the detail of one of its entries and the questions the owner is asked. */
export const accountingBlocks: ReadonlyArray<BlockDefinition> = [
    accountingBookBlock,
    accountingEntryDetailBlock,
    accountingQuestionsBlock,
]

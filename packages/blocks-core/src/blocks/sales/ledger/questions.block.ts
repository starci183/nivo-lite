import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { RequiredAction, RequiredRead, TextSchema } from "../../schema-types"

const props: z.ZodObject<{ label: TextSchema; empty: TextSchema }> = z.object({
    label: specText,
    empty: specText,
})

/** The slots of the questions list: the questions that wait and the action that answers one. */
type Slots = {
    readonly questions: RequiredRead<"record">
    readonly answer: RequiredAction
}
const slots: Slots = {
    questions: { kind: "read", shape: "record", required: true },
    answer: { kind: "action", required: true },
}

/**
 * The questions the accounting department asks the owner: each with the question, the entry it is about, when it was asked and a
 * way to answer it in place, under a head with the count of questions that wait.
 */
export const accountingQuestionsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.questions",
    title: { key: "blockAccountingQuestions" },
    props,
    slots,
    children: false,
})

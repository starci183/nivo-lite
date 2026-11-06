import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID } from "../../bounds"

/** Where a question stands: waiting for the owner, or answered. */
export const QUESTION_STATUSES: readonly [string, ...Array<string>] = ["open", "answered"]

/** The longest question or answer. */
const MAX_TEXT = 2_000

type QuestionFields = {
    readonly text: FieldDef<"text", false>
    readonly source: FieldDef<"text", true>
    readonly status: FieldDef<"enum", false>
    readonly answer: FieldDef<"text", true>
    readonly answeredBy: FieldDef<"text", true>
}

const questionFields: QuestionFields = {
    text: field.text({ maxLength: MAX_TEXT }),
    source: field.text({ maxLength: MAX_ID, nullable: true }),
    status: field.enum({ of: QUESTION_STATUSES, default: { literal: "open" } }),
    answer: field.text({ maxLength: MAX_TEXT, nullable: true }),
    answeredBy: field.text({ maxLength: MAX_ID, nullable: true }),
}

/** A question the accounting department asks the owner: what it asks, the entry or order it is about, and the answer. */
export const accountingQuestionEntity: EntityDefinition<QuestionFields> = defineEntity({
    name: "accounting.question",
    dataKind: "accounting-question",
    fields: questionFields,
    indexes: [
        { name: "status_created", on: ["status", "createdAt", "id"] },
        { name: "source", on: ["source", "id"] },
    ],
})

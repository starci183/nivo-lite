import {
    DECISION_QUEUE_FIXTURE,
    decisionQueueFixtureProps,
    decisionQueueFixtures,
    decisionQueueOutcomes,
} from "../fixtures/decision-queue.fixtures"
import { declaredQueue, editAnswerOf } from "../rows/decision-commands"
import { decisionQueueView } from "../views/views"
import { QUEUE_COMMANDS_MAX, decisionQueueBlock } from "./decision-queue.block"
import { FORM_FIELDS_MAX } from "./form.block"

const WORD = { key: "word" }
const QUEUE = { surface: "card", label: WORD, emptyTitle: WORD, emptyBody: WORD, seeWhy: WORD, moreMenu: WORD }
const COMMAND = { id: "approve", label: WORD }
const EDIT = {
    label: WORD,
    submitLabel: WORD,
    cancelLabel: WORD,
    fields: [{ name: "amount", label: WORD, kind: "money" }],
}
const accepts = (props: unknown): boolean => decisionQueueBlock.props.safeParse(props).success

describe("decisionQueueBlock", () => {
    it("is the core.decision-queue block over a required queue and an optional command", () => {
        expect(decisionQueueBlock.id).toBe("core.decision-queue")
        expect(decisionQueueBlock.children).toBe(false)
        expect(decisionQueueBlock.slots).toEqual({
            queue: { kind: "read", shape: "record", required: true },
            command: { kind: "action", required: false },
        })
    })

    it("takes a queue with no commands, edit or currency, as before", () => {
        expect(accepts(QUEUE)).toBe(true)
        expect(accepts(decisionQueueFixtureProps)).toBe(true)
    })

    it("takes the commands as ids with their words and a look, and refuses what is not a command", () => {
        expect(accepts({ ...QUEUE, commands: [COMMAND, { id: "reject", label: WORD, intent: "danger" }] })).toBe(true)
        expect(accepts({ ...QUEUE, commands: [{ ...COMMAND, intent: "neutral" }] })).toBe(true)
        expect(accepts({ ...QUEUE, commands: [{ ...COMMAND, intent: "loud" }] })).toBe(false)
        expect(accepts({ ...QUEUE, commands: [{ id: "approve" }] })).toBe(false)
        expect(accepts({ ...QUEUE, commands: [{ ...COMMAND, id: "" }] })).toBe(false)
        expect(accepts({ ...QUEUE, commands: [{ ...COMMAND, id: "c".repeat(65) }] })).toBe(false)
    })

    it("bounds the commands and refuses two of one id", () => {
        const many = Array.from({ length: QUEUE_COMMANDS_MAX + 1 }, (_, index) => ({ ...COMMAND, id: `c${index}` }))
        expect(accepts({ ...QUEUE, commands: many.slice(0, QUEUE_COMMANDS_MAX) })).toBe(true)
        expect(accepts({ ...QUEUE, commands: many })).toBe(false)
        expect(accepts({ ...QUEUE, commands: [COMMAND, COMMAND] })).toBe(false)
    })

    it("takes an edit form of declared fields with its words, and a currency", () => {
        expect(accepts({ ...QUEUE, edit: EDIT, currency: "VND" })).toBe(true)
        expect(accepts({ ...QUEUE, currency: "dong" })).toBe(false)
    })

    it("refuses an edit form without fields, with too many, with a field of no kind or without words", () => {
        expect(accepts({ ...QUEUE, edit: { ...EDIT, fields: [] } })).toBe(false)
        const many = Array.from({ length: FORM_FIELDS_MAX + 1 }, (_, index) => ({
            name: `f${index}`,
            label: WORD,
            kind: "text",
        }))
        expect(accepts({ ...QUEUE, edit: { ...EDIT, fields: many } })).toBe(false)
        expect(accepts({ ...QUEUE, edit: { ...EDIT, fields: [{ name: "a", label: WORD, kind: "html" }] } })).toBe(false)
        const { cancelLabel: _cancelLabel, ...withoutCancel } = EDIT
        expect(accepts({ ...QUEUE, edit: withoutCancel })).toBe(false)
    })
})

describe("decisionQueueFixtures", () => {
    it("holds every status of the queue read, which the view schema reads", () => {
        expect(Object.keys(decisionQueueFixtures)).toEqual(["ready", "empty", "error", "loading", "forbidden"])
        expect(decisionQueueView.safeParse(DECISION_QUEUE_FIXTURE).success).toBe(true)
    })

    it("draws the words of the spec on the commands of the sample rows", () => {
        const words = (text: { readonly key: string } | { readonly vi: string; readonly en: string }): string =>
            "key" in text ? text.key : text.en
        const queue = declaredQueue(
            DECISION_QUEUE_FIXTURE,
            decisionQueueFixtureProps.commands ?? [],
            decisionQueueFixtureProps.edit?.label,
            words,
        )
        const [first] = queue.rows
        expect(first?.primary?.label).toBe("Approve")
        expect(first?.edit?.label).toBe("Edit")
        expect(first?.menu.map((entry) => [entry.label, entry.isDanger])).toEqual([["Reject", true]])
    })

    it("answers an edit as done, refused on a field or in conflict", () => {
        expect(editAnswerOf(decisionQueueOutcomes.done).isDone).toBe(true)
        expect(Object.keys(editAnswerOf(decisionQueueOutcomes.invalid).fields)).toEqual(["amount"])
        expect(editAnswerOf(decisionQueueOutcomes.conflict).notice).toEqual({
            vi: "De xuat da doi",
            en: "The proposal changed",
        })
    })
})

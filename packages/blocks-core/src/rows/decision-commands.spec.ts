import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { CommandView, DecisionQueueView, DecisionRowView } from "../views/views.types"
import { COMMAND_INTENTS, declaredQueue, EDIT_COMMAND, editAnswerOf, editFailure } from "./decision-commands"

const words = (text: SpecText): string => ("key" in text ? text.key : text.en)
const command = (id: string, extra: Partial<CommandView> = {}): CommandView => ({ id, label: `view ${id}`, ...extra })
const row = (overrides: Partial<DecisionRowView>): DecisionRowView => ({
    id: "r1",
    title: "T",
    description: "D",
    badges: [],
    reason: null,
    amount: null,
    proposal: "P",
    trace: null,
    expiry: null,
    primary: null,
    edit: null,
    menu: [],
    waitingFor: null,
    ...overrides,
})
const queue = (rows: ReadonlyArray<DecisionRowView>): DecisionQueueView => ({ count: "2", more: null, rows })

describe("declaredQueue", () => {
    it("draws the label of a declared command on the primary, the edit and the menu", () => {
        const source = queue([
            row({ primary: command("approve"), edit: command("edit"), menu: [command("reject"), command("later")] }),
        ])
        const declared = [
            { id: "approve", label: { vi: "Duyet", en: "Approve" } },
            { id: "edit", label: { key: "Sua" } },
            { id: "reject", label: { vi: "Tu choi", en: "Reject" } },
        ]
        const [first] = declaredQueue(source, declared, undefined, words).rows
        expect(first?.primary?.label).toBe("Approve")
        expect(first?.edit?.label).toBe("Sua")
        expect(first?.menu.map((entry) => entry.label)).toEqual(["Reject", "view later"])
    })

    it("sets the look of a declared command and keeps the row's look when the spec names none", () => {
        const source = queue([
            row({ primary: command("a", { isDanger: true }), menu: [command("b", { isDanger: true }), command("c")] }),
        ])
        const declared = [
            { id: "a", label: { key: "A" } },
            { id: "b", label: { key: "B" }, intent: "neutral" as const },
            { id: "c", label: { key: "C" }, intent: "danger" as const },
        ]
        const [first] = declaredQueue(source, declared, undefined, words).rows
        expect(first?.primary?.isDanger).toBe(true)
        expect(first?.menu.map((entry) => entry.isDanger)).toEqual([false, true])
    })

    it("carries the decided, alternative and dismissing looks to the command", () => {
        const source = queue([row({ primary: command("a"), edit: command("b"), menu: [command("c")] })])
        const declared = [
            { id: "a", label: { key: "A" }, intent: "commit" as const },
            { id: "b", label: { key: "B" }, intent: "alternative" as const },
            { id: "c", label: { key: "C" }, intent: "dismiss" as const },
        ]
        const [first] = declaredQueue(source, declared, undefined, words).rows
        expect(first?.primary?.intent).toBe("commit")
        expect(first?.edit?.intent).toBe("alternative")
        expect(first?.menu[0]?.intent).toBe("dismiss")
        expect(first?.primary?.isDanger).toBe(false)
    })

    it("keeps the state of the command and every other field of the row and the queue", () => {
        const pending = command("approve", { isPending: true, isDisabled: true, disabledReason: "why" })
        const source = queue([row({ primary: pending, title: "Keep" })])
        const result = declaredQueue(source, [{ id: "approve", label: { key: "Go" } }], undefined, words)
        expect(result.count).toBe("2")
        expect(result.rows[0]?.title).toBe("Keep")
        expect(result.rows[0]?.primary).toEqual({ ...pending, label: "Go" })
    })

    it("draws the label of the edit form on the edit command of every row that has one", () => {
        const source = queue([row({ edit: command("change") }), row({ id: "r2" })])
        const result = declaredQueue(source, [], { vi: "Sua", en: "Change" }, words)
        expect(result.rows.map((entry) => entry.edit?.label ?? null)).toEqual(["Change", null])
    })

    it("draws a queue as it is when nothing is declared, and rows with no commands", () => {
        const source = queue([row({ primary: command("approve") }), row({ id: "r2" })])
        expect(declaredQueue(source, [], undefined, words)).toEqual(source)
    })
})

describe("editAnswerOf", () => {
    it("closes the form for a saved edit", () => {
        expect(editAnswerOf({ ok: true })).toEqual({ isDone: true, fields: {}, notice: null })
    })

    it("puts the refused fields on their fields, with the message when the server gave one", () => {
        const fields = { amount: { key: "too_big" } }
        expect(editAnswerOf({ ok: false, reason: "invalid", fields })).toEqual({ isDone: false, fields, notice: null })
        const message = { key: "nope" }
        expect(editAnswerOf({ ok: false, reason: "invalid", fields, message })).toEqual({
            isDone: false,
            fields,
            notice: message,
        })
    })

    it("shows the message of a refusal, a conflict or a failure in the form", () => {
        const message = { key: "stale" }
        for (const reason of ["refused", "conflict", "forbidden", "failed"] as const) {
            expect(editAnswerOf({ ok: false, reason, message })).toEqual({ isDone: false, fields: {}, notice: message })
        }
    })
})

describe("the edit constants", () => {
    it("name the edit command, the looks of a command and the failure of a run", () => {
        expect(EDIT_COMMAND).toBe("edit")
        expect(COMMAND_INTENTS).toEqual(["commit", "alternative", "dismiss", "neutral", "danger"])
        expect(editFailure).toEqual({ isDone: false, fields: {}, notice: { key: "slotError" } })
    })
})

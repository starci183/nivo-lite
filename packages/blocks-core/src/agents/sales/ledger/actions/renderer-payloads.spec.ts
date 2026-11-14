import { actionPayloadOf, parseStrict } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionInput } from "@nivo-lite/agent-sdk/block"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { MODULE_DECLARATIONS } from "../../../../shared/modules/module-declarations"
import { ORDER, TRANSACTION } from "../rules/accounting.fixtures"
import { pickedValues } from "../../../../shared/rows/decision-choices"
import type { Choice } from "../../../../shared/rows/decision-choices"
import { editInputOf, queueInputOf } from "../../../../shared/rows/decision-commands"
import { answerInputOf } from "../rules/question-rows"
import { salesModule } from "../../declaration"

/**
 * The payload the renderers produce, carried through the same two steps the live app takes (the queue's input builder, then the
 * host's `actionPayloadOf`, which is what the door receives), must be accepted by the strict input schema of the action it is
 * bound to. A schema that expects another shape (a nested `values`) is refused by the door as invalid, and the screen only says
 * it could not load the item: this is the spec that catches the two shapes drifting apart.
 */

interface BoundQueue {
    readonly module: string
    readonly action: string
    readonly choices: ReadonlyArray<Choice>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Every `core.decision-queue` of a module's spec documents that declares choices, with the action it is bound to. */
const isChoice = (value: unknown): value is Choice =>
    isRecord(value) && typeof value["command"] === "string" && typeof value["sends"] === "string"

const queuesOf = (module: ModuleDeclaration): ReadonlyArray<BoundQueue> => {
    const found: Array<BoundQueue> = []
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (!isRecord(node)) return
        if (node["block"] === "core.decision-queue") {
            const props = node["props"]
            const bind = node["bind"]
            const command = isRecord(bind) ? bind["command"] : undefined
            const action = isRecord(command) ? command["action"] : undefined
            const choices = isRecord(props) ? props["choices"] : undefined
            if (typeof action === "string" && Array.isArray(choices))
                found.push({ module: module.key, action, choices: choices.filter(isChoice) })
        }
        Object.values(node).forEach(walk)
    }
    module.specs.forEach(walk)
    return found
}

const actionOf = (module: ModuleDeclaration, id: string): ActionDefinition | undefined =>
    module.actions.find((each) => each.id === id)

/** The payload the door receives for an input, as the live host builds it. */
const doorPayload = (input: ActionInput): unknown => actionPayloadOf(input)

const accepted = (action: ActionDefinition | undefined, input: ActionInput): boolean =>
    action?.input !== undefined && parseStrict(action.input, doorPayload(input)).ok

describe("the payloads the renderers send", () => {
    const queues = MODULE_DECLARATIONS.flatMap((module) => queuesOf(module).map((queue) => ({ module, queue })))

    it("finds the queues that declare choices, so this spec cannot pass by checking nothing", () => {
        expect(queues.map(({ queue }) => `${queue.module}:${queue.action}`)).toContain(
            "sales:sales.decide-owner-item",
        )
    })

    it("accepts, for every choice of every decision queue, the payload of the pick or the confirmation", () => {
        for (const { module, queue } of queues) {
            const action = actionOf(module, queue.action)
            for (const choice of queue.choices) {
                const values = pickedValues(choice, ORDER.id) ?? choice.confirm?.values
                expect({
                    choice: choice.command,
                    ok: accepted(action, queueInputOf(TRANSACTION.id, choice.sends, values)),
                }).toEqual({
                    choice: choice.command,
                    ok: true,
                })
            }
        }
    })

    it("sends the picked order beside the id, as the resolve action reads it", () => {
        const input = queueInputOf(TRANSACTION.id, "sales.resolve-unmatched-payment", { order: ORDER.id })
        expect(doorPayload(input)).toEqual({
            id: TRANSACTION.id,
            command: "sales.resolve-unmatched-payment",
            order: ORDER.id,
        })
    })

    it("accepts the answer of a question and an edit of a queue row", () => {
        const answer = actionOf(salesModule, "sales.answer-question")
        expect(accepted(answer, answerInputOf("q1", "Received in full"))).toBe(true)
        expect(accepted(answer, editInputOf("q1", { answer: "Received in full" }))).toBe(true)
    })

    it("refuses the nested shape, naming the keys the door cannot read", () => {
        const resolve = actionOf(salesModule, "sales.resolve-unmatched-payment")
        const nested = {
            id: TRANSACTION.id,
            command: "sales.resolve-unmatched-payment",
            values: { order: ORDER.id },
        }
        const parsed = resolve?.input === undefined ? null : parseStrict(resolve.input, nested)
        expect(parsed !== null && !parsed.ok ? parsed.problems : []).toContainEqual({
            code: "INPUT_UNKNOWN_KEY",
            at: "values",
        })
    })
})

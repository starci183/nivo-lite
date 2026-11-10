import { AIMessage } from "@langchain/core/messages"
import type { AgentLoopAnswer, AgentLoopAnswerCall } from "./agent-loop.port"

/** A plain object. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** One call as the library read it: the provider may have given it no id. */
interface ReadCall {
    /** The provider's id of the call, when it gave one. */
    readonly id: string | undefined
    /** The name the model wrote. */
    readonly name: string
    /** The parsed arguments, or the text the model wrote. */
    readonly args: unknown
}

/**
 * A model answer as plain data. The well-formed tool calls come first, then the ones whose arguments were no JSON object (the
 * library keeps the two apart and loses their order); such a call keeps the text the model wrote as its arguments, so the runner
 * refuses it by name. A call the provider gave no id gets one from its place in the turn: the id only addresses the tool message.
 *
 * @param message - The answer as the model side handed it back.
 * @param turn - The number of the model turn, from 1.
 * @returns The answer, plain JSON.
 */
export const answerOf = (message: AIMessage, turn: number): AgentLoopAnswer => {
    const taken = (message.tool_calls ?? []).map((call): ReadCall => ({ id: call.id, name: call.name, args: call.args }))
    const unread = (message.invalid_tool_calls ?? []).map(
        (call): ReadCall => ({ id: call.id, name: call.name ?? "", args: call.args ?? "" }),
    )
    return {
        text: message.text,
        calls: [...taken, ...unread].map(
            (call, index): AgentLoopAnswerCall => ({ ...call, id: call.id ?? `turn-${turn}-call-${index + 1}` }),
        ),
    }
}

/**
 * The message the loop goes on with, built from the plain answer whether it came from the model just now or from the record of an
 * earlier run of the node: one road, so what the provider is sent back on the next turn is the same bytes either way. It carries
 * the words and the calls only; reasoning, token counts and provider fields are the model side's and are not sent back. A call
 * whose arguments were no JSON object is shown with empty arguments, so the request stays well-formed; its refusal says why.
 *
 * @param answer - The plain answer.
 * @returns The message.
 */
export const messageOf = (answer: AgentLoopAnswer): AIMessage =>
    new AIMessage({
        content: answer.text,
        tool_calls: answer.calls.map((call) => ({
            type: "tool_call",
            id: call.id,
            name: call.name,
            args: isRecord(call.args) ? { ...call.args } : {},
        })),
    })

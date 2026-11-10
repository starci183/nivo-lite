import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages"
import type { NodeAgentCallAnswer, NodeAgentEndAnswer, NodeAgentLoop } from "@nivo-lite/agent-sdk/node"
import { createMiddleware, type AgentMiddleware } from "langchain"
import { digestOf } from "../asked-digest.policy"
import type { AgentLoopAnswer, AgentLoopModel, AgentLoopRecord } from "./agent-loop.port"
import { CONFUSED_TOOL, DONE_TOOL, ONE_CALL_REFUSAL, TOOL_CALL_REFUSAL, type LoopRefusal } from "./loop-frame.policy"
import type { ToolNames } from "./tool-names.policy"
import { answerOf, isRecord, messageOf } from "./turn-answer.mapper"

/** The name the library knows the loop's one middleware by. */
export const STEP_MIDDLEWARE = "NivoStep"

/** Runs a function where the node that called the loop runs, so a call it makes is a call of that node (its record, its lock). */
export type InCaller = <Value>(act: () => Promise<Value>) => Promise<Value>

/** What a tool call is answered: a fact of the runner, or a refusal of the loop's own. */
type CallFact = NodeAgentCallAnswer | NodeAgentEndAnswer | LoopRefusal

/** The middleware of one run, with its tally. */
export interface StepMiddleware {
    /** The one middleware the agent is built with. */
    readonly middleware: AgentMiddleware
    /** What the run has come to. */
    readonly tally: StepTally
}

/** What the middleware of one run is given beside the frame and the model. */
export interface StepScope {
    /** The names of the run: as written, or wire names. */
    readonly names: ToolNames
    /** The record of the model turns; a pass-through when the caller keeps none. */
    readonly record: AgentLoopRecord
    /** Where the runner's closures and the model side are called. */
    readonly inCaller: InCaller
}

/** What one run of the loop has come to so far. */
export interface StepTally {
    /** The turns charged: one per model answer, and one more for every call of an answer after its first. */
    readonly turns: () => number
    /**
     * The rejection of the model side or of a closure, as the very promise that rejected, when one did; null otherwise. The library
     * wraps what leaves a hook, so the client answers with this promise and the error leaves as it was thrown.
     */
    readonly failed: () => Promise<unknown> | null
}

/** The answer being worked on: the model's last, and whether its one call was taken. */
interface OpenAnswer {
    /** The answer. */
    readonly answer: AgentLoopAnswer
    /** True once its first call was taken. */
    taken: boolean
}

/** What the loop keeps between hooks of one run. */
interface StepState {
    /** Model answers so far. */
    asked: number
    /** Turns charged so far. */
    used: number
    /** True once an output or a confusion was taken. */
    ended: boolean
    /** The model's last answer; null before the first. */
    open: OpenAnswer | null
    /** The first rejection that went through a hook. */
    failed: Promise<unknown> | null
}

/** One message of a request as plain data: its kind, its content, the calls it made or the call it answers. Never the library's id. */
const plainOf = (message: BaseMessage): unknown => ({
    type: message.type,
    content: message.content,
    calls: AIMessage.isInstance(message)
        ? (message.tool_calls ?? []).map(({ id, name, args }) => ({ id, name, args }))
        : undefined,
    answers: ToolMessage.isInstance(message) ? message.tool_call_id : undefined,
})

/**
 * The name a model turn is recorded under: the loop's purpose and the turn, then a digest of everything the turn sends (the craft and
 * shop values, the tool names, every message so far). A node that starts again and would send the same turn gets its recorded answer;
 * one whose turn would send other words (a new customer line read at the start, another fact) asks the model again, with every turn
 * after it. Only the plain answer is kept under this name, never the messages: the record stays the size of the model's answers.
 *
 * @param loop - The frame of the run.
 * @param turn - The number of the model turn, from 1.
 * @param messages - The messages the turn sends after the system message.
 * @returns `<purpose>#<turn>:<digest>`.
 */
export const turnCallOf = (loop: NodeAgentLoop, turn: number, messages: ReadonlyArray<BaseMessage>): string =>
    `${loop.purpose}#${String(turn)}:${digestOf({
        instructions: loop.instructions,
        tools: loop.tools.map((tool) => tool.name),
        messages: messages.map(plainOf),
    })}`

/** A confusion as the model wrote it, handed on for the runner to judge. */
const confusionOf = (args: unknown): Parameters<NodeAgentLoop["confused"]>[0] => {
    const said = isRecord(args) ? args : {}
    return {
        reason: typeof said.reason === "string" ? said.reason : "",
        question: typeof said.question === "string" ? said.question : null,
    }
}

/**
 * The one middleware of the loop. The library moves the model from turn to turn; everything a turn does is decided here and in the
 * runner's closures:
 *
 * - **Before a model turn**: the loop ends when an output or a confusion was taken, or when the turns are used up.
 * - **The model turn**: one call of `model.turn`, which owns the tries, the deadlines and the meter. The answer is turned into plain
 *   data (kept by the record when there is one) and the message the loop goes on with is built from that, live or replayed alike.
 * - **After it**: an answer with no tool call is answered with a refusal as the next user message; the turn is spent.
 * - **A tool call**: the library runs no tool body. Only the first call of an answer is taken: `done` and `confused` are answered
 *   by the runner's `done` and `confused`, every other name by its `call`, one at a time, and the fact it answers is the tool
 *   message. Every other call of that answer is refused (`ONE_CALL_PER_TURN`) without asking the runner, and costs a turn.
 *
 * Nothing thrown is turned into a message: what the model side or a closure throws is kept as it was thrown, for the client to let
 * out unchanged.
 *
 * @param loop - The frame and the closures the runner handed over.
 * @param model - The model side.
 * @param scope - The names, the record and where the caller runs.
 * @returns The middleware and the tally of the run.
 */
export const stepMiddlewareOf = (loop: NodeAgentLoop, model: AgentLoopModel, scope: StepScope): StepMiddleware => {
    const state: StepState = { asked: 0, used: 0, ended: false, open: null, failed: null }
    const kept = <Value>(act: () => Promise<Value>): Promise<Value> => {
        const pending = Promise.resolve().then(act)
        // Kept as the rejection it is, for the client to answer with; the cause is handed on, never dropped.
        void pending.then(undefined, (cause: unknown) => {
            state.failed ??= pending
            return { cause }
        })
        return pending
    }
    const ending = (judged: NodeAgentEndAnswer): Promise<CallFact> => {
        state.ended = judged.ok
        return Promise.resolve(judged)
    }
    const taken = (name: string, args: unknown): Promise<CallFact> => {
        if (name === DONE_TOOL) return ending(loop.done(isRecord(args) ? args.output : undefined))
        if (name === CONFUSED_TOOL) return ending(loop.confused(confusionOf(args)))
        return scope.inCaller(() => loop.call(scope.names.idOf(name), args))
    }
    const middleware = createMiddleware({
        name: STEP_MIDDLEWARE,
        beforeModel: {
            canJumpTo: ["end"],
            hook: () => (state.ended || state.used >= loop.maxTurns ? { jumpTo: "end" as const } : undefined),
        },
        wrapModelCall: async (request, handler) => {
            state.asked += 1
            state.used += 1
            const turn = state.asked
            const ask = async (): Promise<AgentLoopAnswer> => {
                const message = await model.turn((client) =>
                    Promise.resolve(
                        handler({
                            ...request,
                            model: client,
                            toolChoice: model.toolChoice,
                            modelSettings: { ...request.modelSettings, parallel_tool_calls: false },
                        }),
                    ),
                )
                return answerOf(message, turn)
            }
            const call = turnCallOf(loop, turn, request.messages)
            const answer = await kept(() => scope.inCaller(() => scope.record(call, ask)))
            state.open = { answer, taken: false }
            state.used += Math.max(0, answer.calls.length - 1)
            return messageOf(answer)
        },
        afterModel: {
            canJumpTo: ["model"],
            hook: (graph) => {
                const last = graph.messages.at(-1)
                if (!AIMessage.isInstance(last) || (last.tool_calls ?? []).length > 0) return undefined
                // The turns are used up: the loop ends here, with nothing taken.
                if (state.used >= loop.maxTurns) return undefined
                return { messages: [new HumanMessage(JSON.stringify(TOOL_CALL_REFUSAL))], jumpTo: "model" as const }
            },
        },
        wrapToolCall: async (request) => {
            const { id, name } = request.toolCall
            const open = state.open
            const first = open?.answer.calls[0]
            const fact = (): Promise<CallFact> => {
                // Decided before anything is awaited, so two calls of one answer can never both be taken.
                if (open === null || first === undefined || open.taken || first.id !== id) return Promise.resolve(ONE_CALL_REFUSAL)
                open.taken = true
                return kept(() => taken(name, first.args))
            }
            const answered = await fact()
            return new ToolMessage({
                tool_call_id: id ?? "",
                name,
                content: JSON.stringify(answered),
                ...(answered.ok ? {} : { status: "error" as const }),
            })
        },
    })
    const tally: StepTally = { turns: () => state.used, failed: () => state.failed }
    return { middleware, tally }
}

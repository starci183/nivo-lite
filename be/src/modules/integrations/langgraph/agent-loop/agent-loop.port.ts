import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { NodeAgentLoop, NodeAgentLoopEnd } from "@nivo-lite/agent-sdk/node"

/** Asks the model once with the client of one try, and resolves to what the call answered. */
export type AgentLoopAttempt<Answer> = (model: BaseChatModel, tryNumber: number) => Promise<Answer>

/**
 * The model of one step's agent, as the loop takes it: the shape `AiAgentTurns` of `integrations/ai` has, read structurally so this
 * folder imports nothing of that integration. The loop builds no client and holds no try policy, deadline or meter: it hands `turn`
 * the way to ask once and gets back the message of the try that stood.
 */
export interface AgentLoopModel {
    /** The tool choice of every request of the step: `required` only when the step's node asks for reasoning off, else `auto`. */
    readonly toolChoice: "auto" | "required"
    /**
     * Takes ONE agent turn under the tries policy: calls `attempt` once per try with that try's client, judges and meters each
     * answer, and resolves to what the try that stood resolved to. When every try failed it throws its own error; the loop lets that
     * error out unchanged.
     */
    turn<Answer>(attempt: AgentLoopAttempt<Answer>): Promise<Answer>
    /**
     * A chat client to build the agent over: the library refuses to build one without a model. The loop never asks it anything:
     * every model turn goes through `turn`. Absent (no AI endpoint is configured), the loop builds no agent and takes no turn: the
     * run ends as `turn` ends it, with the model side's own error. It may be a promise: the router reads the gateway's catalog to
     * know which protocol's client the name gets (`@starci/ai-router/langchain` 0.7.0), so the model side hands it over async.
     */
    readonly model?: BaseChatModel | PromiseLike<BaseChatModel | undefined> | undefined
    /**
     * True when the model's profile cannot take a dot in a tool name: tools are then shown under wire names (`.` -> `__`) and read
     * back. Absent or false, names are sent as written.
     */
    readonly wireNames?: boolean | undefined
}

/** One tool call of a model answer, as plain data. */
export interface AgentLoopAnswerCall {
    /** The address of the call within its answer: only what its tool message is sent back under, never a key of anything. */
    readonly id: string
    /** The name the model wrote. */
    readonly name: string
    /** The arguments: the parsed JSON object, or the text as the model wrote it when it was no JSON object. */
    readonly args: unknown
}

/** One answer of the model as plain data: what a record of the turn keeps, and all the loop goes on with. */
export interface AgentLoopAnswer {
    /** The words of the answer; empty when it only called tools. */
    readonly text: string
    /** Its tool calls, in the order they are taken: the well-formed ones, then the ones whose arguments were no JSON object. */
    readonly calls: ReadonlyArray<AgentLoopAnswerCall>
}

/**
 * Keeps the answer of one model turn with the run of the node, so a node that starts again is handed the same answer instead of
 * asking the model anew. `act` asks the model; the value it resolves to is plain JSON.
 */
export type AgentLoopRecord = (call: string, act: () => Promise<AgentLoopAnswer>) => Promise<AgentLoopAnswer>

/** What the caller may add to one run of the loop. */
export interface AgentLoopOptions {
    /** The record of the model turns; absent, every turn asks the model. */
    readonly record?: AgentLoopRecord | undefined
}

/** The loop of a step's agent on the library's prebuilt agent: the host side of `NodeHostPorts.agent`. */
export interface AgentLoops {
    /**
     * Takes the turns of one step's agent: shows the model the frame the runner handed over, answers each of its calls with what the
     * runner's closure answered, and returns when an output or a confusion was taken or the turns ran out.
     */
    run(loop: NodeAgentLoop, model: AgentLoopModel, options?: AgentLoopOptions): Promise<NodeAgentLoopEnd>
}

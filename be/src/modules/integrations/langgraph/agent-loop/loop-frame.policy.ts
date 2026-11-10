import type { NodeAgentLoop, NodeAgentLoopTool, NodeAgentRefusal } from "@nivo-lite/agent-sdk/node"
import type { ToolNames } from "./tool-names.policy"

/** The tool the model calls to give the step's output. Never an id of NIVO: those carry a dot. */
export const DONE_TOOL = "done"

/** The tool the model calls to say it cannot reach the goal without guessing. */
export const CONFUSED_TOOL = "confused"

/** The code of the refusal every call after the first of one model answer gets. */
export const ONE_CALL_PER_TURN = "ONE_CALL_PER_TURN"

/** The code of the refusal an answer with no tool call gets. */
export const TOOL_CALL_REQUIRED = "TOOL_CALL_REQUIRED"

/** The function of a tool: its name, what it does, the JSON Schema of its arguments. */
export interface WireFunction {
    /** The name the model calls it by. */
    readonly name: string
    /** What it does, in words. */
    readonly description: string
    /** The JSON Schema of its arguments. */
    readonly parameters: unknown
}

/** One tool as an OpenAI-style chat API takes it. The loop writes it itself so its bytes are the same on every step and in every process. */
export interface WireTool {
    /** Always a function. */
    readonly type: "function"
    /** The function. */
    readonly function: WireFunction
}

/** The schema of a tool that declares none: any JSON object. */
const ANY_OBJECT = { type: "object", properties: {} }

/** The loop's own two tools, the same for every step of every agent: they close the tool list. */
const END_TOOLS: ReadonlyArray<WireTool> = [
    {
        type: "function",
        function: {
            name: DONE_TOOL,
            description:
                "Give the step's output when its goal is reached. `output` must fit the step's `outputSchema`, and every tool the step lists as `required` must have succeeded first.",
            parameters: { type: "object", properties: { output: {} }, required: ["output"] },
        },
    },
    {
        type: "function",
        function: {
            name: CONFUSED_TOOL,
            description:
                "Say that you cannot reach the step's goal without guessing: `reason` is why, plainly; `question` is what a person must answer, or null.",
            parameters: {
                type: "object",
                properties: { reason: { type: "string" }, question: { type: ["string", "null"] } },
                required: ["reason", "question"],
            },
        },
    },
]

/** What a tool does, as words: the runner hands a text; anything else is shown as its JSON. */
const wordsOf = (does: unknown): string => (typeof does === "string" ? does : JSON.stringify(does ?? ""))

/**
 * The tool list of a request: the agent's whole set in the order the runner gave (name order), each with the schema the runner
 * made (handed on as it is, never generated again), then the loop's own `done` and `confused`. The step's allow-list never changes
 * this list: a tool the step does not declare is refused when it is called.
 *
 * @param tools - The agent's whole tool set, as the runner handed it over.
 * @param names - The names of the run (as written, or wire names).
 * @returns The list, the same bytes for every step of one agent.
 */
export const wireToolsOf = (tools: ReadonlyArray<NodeAgentLoopTool>, names: ToolNames): ReadonlyArray<WireTool> => [
    ...tools.map(
        (tool): WireTool => ({
            type: "function",
            function: {
                name: names.shown(tool.name),
                description: wordsOf(tool.does),
                parameters: tool.argsSchema ?? ANY_OBJECT,
            },
        }),
    ),
    ...END_TOOLS,
]

/**
 * The words of the first user message: the step (L3) at the very start, so everything before it (system text, tools) is shared by
 * every step of the agent; then what holds for this try only (L4): the volatile rules when the turn has them, and the input as JSON.
 *
 * @param loop - The frame of the step.
 * @returns The text.
 */
export const openingTextOf = (loop: Pick<NodeAgentLoop, "step" | "volatile" | "input">): string => {
    const volatile = (loop.volatile ?? "").trim()
    return [loop.step, ...(volatile === "" ? [] : [volatile]), JSON.stringify(loop.input ?? null)].join("\n\n")
}

/** A refusal the loop makes itself, in the shape the runner's own refusals have. */
export interface LoopRefusal {
    /** Never true. */
    readonly ok: false
    /** Why. */
    readonly refused: NodeAgentRefusal
}

/** What every call after the first of one model answer is answered: nothing was run for it. */
export const ONE_CALL_REFUSAL: LoopRefusal = {
    ok: false,
    refused: {
        code: ONE_CALL_PER_TURN,
        message: "One tool call per turn: only the first call of this turn was taken. Nothing was done for this one; call it in a later turn if it is still needed.",
    },
}

/** What an answer with no tool call is answered: the turn is spent. */
export const TOOL_CALL_REFUSAL: LoopRefusal = {
    ok: false,
    refused: {
        code: TOOL_CALL_REQUIRED,
        message: `Answer with one tool call: a tool of the step, \`${DONE_TOOL}\` with the step's output, or \`${CONFUSED_TOOL}\`. Words alone do nothing.`,
    },
}

/**
 * How many steps the library may take for one run before it stops it. A model turn is at most four of them (the gate, the model,
 * the check of its answer, the tools); the bound is twice that with room to spare, so only a fault of the loop itself can reach it.
 *
 * @param maxTurns - The most model turns of the step.
 * @returns The bound.
 */
export const stepBoundOf = (maxTurns: number): number => maxTurns * 8 + 16

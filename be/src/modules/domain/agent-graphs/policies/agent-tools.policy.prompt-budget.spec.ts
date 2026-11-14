import { z } from "zod"
import { defineNode, runNode, type NodeAgentLoop, type NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { INSTALLED, INSTALLED_MODULES } from "@modules/domain/installed-plugins"
import { coreNodeIndex } from "@modules/domain/installed-plugins/installed-plugins.testing"
import { withDefaultReads } from "./agent-tools.policy"

/**
 * The size budget of the stable opening of an agent's model call (prompt-cache L1: the agent's craft and its whole tool set), measured
 * on the REAL installation through the SDK's own runner: what `runNode` hands the host's agent loop (`NodeAgentLoop.instructions` and
 * `NodeAgentLoop.tools`) for every installed agent, its set as the engine shows it (`withDefaultReads`).
 *
 * Why it exists: on dev (RESTART-R3, 2026-11-14) every agent call carried ~446k-461k prompt tokens, because one tool's argument
 * schema (`nivo.tool.record.list`, its `where` filter tree unrolled to depth 6 and inlined at every level) rendered as ~816k chars of
 * JSON Schema. Measured in characters (deterministic); schema JSON ran at ~1.9 chars per token on Anthropic's meter, so the budgets
 * below are at most ~8k tokens for one tool and ~42k tokens for the whole opening of one agent.
 */
const TOOL_SCHEMA_CHARS_MAX = 16_000
const AGENT_OPENING_CHARS_MAX = 80_000

/** A probe step whose agent shows the installed agent's whole set: the runner lays its call out exactly as for any real step. */
const probe = defineNode({
    id: "core.prompt-budget-probe",
    role: "output",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ text: z.string() }),
    output: z.object({ ok: z.boolean() }),
    effects: [],
    examples: [{ name: "probe", params: {}, input: { text: "probe" }, output: { ok: true }, effects: [] }],
    run: async (input, context) => {
        const decision = await context.agent.run({ goal: "Probe.", input, output: z.object({ ok: z.boolean() }), maxTurns: 1 })
        return decision.kind === "answer" ? decision.value : { ok: false }
    },
})

/** What a port the probe must never reach answers: the step's agent takes no turn, so nothing is read, written or called. */
const unreachable = (): Promise<never> => Promise.reject(new Error("unreachable"))

/** The loop `runNode` hands the host for one installed agent, on the given turn and input. */
const loopOf = async (moduleKey: string, turnId: string, text: string): Promise<NodeAgentLoop> => {
    const agent = INSTALLED.agentOf(moduleKey)
    const index = coreNodeIndex()
    const seen: Array<NodeAgentLoop> = []
    const ports: NodeHostPorts = {
        read: unreachable,
        write: unreachable,
        execute: unreachable,
        callTool: unreachable,
        model: { text: unreachable, json: unreachable } as unknown as NodeHostPorts["model"],
        now: () => new Date("2026-11-14T00:00:00.000Z"),
        agent: (loop) => {
            seen.push(loop)
            return Promise.resolve({ turns: 1 })
        },
    }
    const guidance = INSTALLED.guidanceOf(moduleKey, "vi")
    await runNode(
        {
            node: probe,
            params: {},
            input: { text },
            turn: {
                turnId,
                workspaceId: "ws-budget",
                agentId: `agent-${moduleKey}`,
                subject: null,
                ...(guidance === "" ? {} : { guidance }),
                agentTools: withDefaultReads(agent?.tools ?? []),
            },
            grant: {},
            effects: index.effects,
            tools: index.tools,
            key: `${turnId}:probe`,
        },
        ports,
    ).catch(() => null)
    const [loop] = seen
    if (loop === undefined) throw new Error(`no agent loop for ${moduleKey}`)
    return loop
}

/** The modules of the installation that declare an agent. */
const AGENT_MODULES = INSTALLED_MODULES.map((module) => module.key).filter((key) => INSTALLED.agentOf(key) !== null)

describe("the stable opening of every installed agent's model call (prompt-cache L1)", () => {
    it("covers the installed agents the engine runs", () => {
        expect(AGENT_MODULES).toEqual(expect.arrayContaining(["chatbot", "sales"]))
    })

    it.each(AGENT_MODULES)("%s: no tool schema over the budget, and the whole opening (craft + tool set) within it", async (moduleKey) => {
        const loop = await loopOf(moduleKey, "turn-1", "first")
        const oversized = loop.tools
            .map((tool) => ({ tool: tool.name, chars: JSON.stringify(tool.argsSchema ?? null).length }))
            .filter((one) => one.chars > TOOL_SCHEMA_CHARS_MAX)
        const opening = loop.instructions.length + JSON.stringify(loop.tools).length

        expect(oversized).toEqual([])
        expect(opening).toBeLessThanOrEqual(AGENT_OPENING_CHARS_MAX)
    })

    it.each(AGENT_MODULES)("%s: the opening is the same bytes on another turn with another input (nothing volatile in L1)", async (moduleKey) => {
        const first = await loopOf(moduleKey, "turn-1", "first")
        const again = await loopOf(moduleKey, "turn-2", "a different customer line")

        expect(again.instructions).toBe(first.instructions)
        expect(JSON.stringify(again.tools)).toBe(JSON.stringify(first.tools))
        expect(again.instructions).not.toContain("a different customer line")
    })
})

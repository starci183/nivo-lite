import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import type { DataRight } from "../rights/rights.types"
import { EXAMPLE_TURN, nodeExampleMismatches } from "../testing/node-examples"
import { scriptedNodePorts } from "../testing/node-ports"
import { defineDataKind, defineTool } from "./effect"
import { runNode } from "./host"
import type { NodeRunRequest } from "./host.types"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { graphNodeProblems, nodeIndexOf, nodeListProblems } from "./problems"
import { RightsDeniedError } from "./rights-denied-error"
import { ToolUndeclaredError } from "./tool-undeclared-error"

const READ: DataRight = { kind: "order", access: "read", scope: "turn", fields: ["id"] }

const instruction = defineTool({
    id: "payment.instruction",
    title: { key: "i" },
    args: z.object({ orderNo: z.string().max(200) }),
    result: z.object({ qrUrl: z.string().max(200) }),
    mutates: false,
    rights: [READ],
})

const charge = defineTool({ ...instruction, id: "payment.charge", mutates: true, rights: [] })

/** A node that calls the tool its input names. */
const caller = defineNode({
    id: "payment.caller",
    role: "execute",
    title: { key: "c" },
    params: z.object({}),
    input: z.object({ tool: z.string().max(200), orderNo: z.unknown() }),
    output: z.object({ qrUrl: z.string().max(200) }),
    rights: [],
    effects: [],
    tools: ["payment.instruction", "payment.charge", "payment.ghost"],
    run: (input, context) => context.tools.call<{ qrUrl: string }>(input.tool as "a.b", { orderNo: input.orderNo }),
    examples: [
        {
            name: "asks",
            params: {},
            input: { tool: "payment.instruction", orderNo: "A1" },
            output: { qrUrl: "q" },
            effects: [],
            tools: [{ qrUrl: "q" }],
            grant: { rights: [READ], tools: ["payment.instruction"] },
        },
    ],
}) as unknown as NodeDefinition

const tools = new Map([
    [instruction.id, instruction],
    [charge.id, charge],
]) as unknown as NodeRunRequest["tools"]

const requestOf = (tool: string, overrides: Partial<NodeRunRequest> = {}): NodeRunRequest => ({
    node: caller,
    params: {},
    input: { tool, orderNo: "A1" },
    turn: EXAMPLE_TURN,
    grant: { rights: [READ], tools: ["payment.instruction", "payment.charge"] },
    effects: new Map(),
    tools,
    key: "run-1:step",
    ...overrides,
})

describe("defineTool", () => {
    it("defines a tool and refuses a malformed tool id on a node", () => {
        expect(instruction.entry).toBe("tool")
        expect(() => defineTool({ ...instruction, id: "Bad" as "a.b" })).toThrow(SdkDefinitionError)
        expect(() => defineNode({ ...caller, tools: ["Bad.x"] } as never)).toThrow(SdkDefinitionError)
    })
})

describe("runNode tools", () => {
    it("calls a declared, installed, granted tool with parsed args and a keyed call", async () => {
        const fake = scriptedNodePorts({ tools: [{ qrUrl: "q" }] })
        await expect(runNode(requestOf("payment.instruction"), fake.ports)).resolves.toEqual({
            output: { qrUrl: "q" },
            effects: [],
        })
        expect(fake.toolCalls).toEqual([
            { id: "payment.instruction", args: { orderNo: "A1" }, key: "run-1:step:tool:0" },
        ])
    })

    it("refuses an undeclared, uninstalled or ungranted tool", async () => {
        const { ports } = scriptedNodePorts({ tools: [{ qrUrl: "q" }] })
        await expect(runNode(requestOf("payment.other"), ports)).rejects.toThrow(ToolUndeclaredError)
        const toolless = { ...caller, tools: undefined } as unknown as NodeDefinition
        await expect(runNode(requestOf("payment.instruction", { node: toolless }), ports)).rejects.toThrow(
            ToolUndeclaredError,
        )
        await expect(runNode(requestOf("payment.ghost"), ports)).rejects.toThrow("TOOL_UNKNOWN")
        const unnamed = { rights: [READ] }
        await expect(runNode(requestOf("payment.instruction", { grant: unnamed }), ports)).rejects.toThrow(
            RightsDeniedError,
        )
        const rightless = { rights: [], tools: ["payment.instruction"] }
        await expect(runNode(requestOf("payment.instruction", { grant: rightless }), ports)).rejects.toThrow(
            RightsDeniedError,
        )
    })

    it("refuses bad args, a bad answer, an unscripted call, and a mutating tool from a condition", async () => {
        await expect(
            runNode(
                requestOf("payment.instruction", { input: { tool: "payment.instruction", orderNo: 1 } }),
                scriptedNodePorts().ports,
            ),
        ).rejects.toThrow("TOOL_ARGS_INVALID")
        await expect(runNode(requestOf("payment.charge"), scriptedNodePorts({ tools: [{}] }).ports)).rejects.toThrow(
            "TOOL_RESULT_INVALID",
        )
        await expect(runNode(requestOf("payment.charge"), scriptedNodePorts().ports)).rejects.toThrow("TOOL_UNSCRIPTED")
        const condition = { ...caller, role: "condition" } as NodeDefinition
        await expect(
            runNode(requestOf("payment.charge", { node: condition }), scriptedNodePorts().ports),
        ).rejects.toThrow("TOOL_MUTATES")
    })

    it("runs an example with scripted tool results, granting the node's own tools by default", async () => {
        const [example] = caller.examples
        await expect(nodeExampleMismatches(caller, example, [], [instruction])).resolves.toEqual([])
        const { grant: _grant, ...defaulted } = example
        const open = defineTool({ ...instruction, rights: [] })
        await expect(nodeExampleMismatches(caller, defaulted, [], [open])).resolves.toEqual([])
    })
})

describe("tool problems", () => {
    const order = defineDataKind({ kind: "order", title: { key: "o" }, fields: z.object({ id: z.string().max(200) }) })
    const condition = { ...caller, id: "payment.check", role: "condition" } as NodeDefinition

    it("names an unknown tool, a mutating tool in a condition, a duplicate and a tool right over an unknown kind", () => {
        expect(
            nodeListProblems({
                nodes: [caller, condition],
                effects: [],
                tools: [instruction, charge, charge],
                dataKinds: [],
            }),
        ).toEqual([
            { code: "TOOL_DUPLICATE", at: "payment.charge" },
            { code: "NODE_TOOL_UNKNOWN", at: "payment.caller:payment.ghost" },
            { code: "NODE_CONDITION_MUTATES", at: "payment.check:payment.charge" },
            { code: "NODE_TOOL_UNKNOWN", at: "payment.check:payment.ghost" },
            { code: "RIGHT_KIND_UNKNOWN", at: "payment.instruction:order" },
        ])
        expect(nodeListProblems({ nodes: [], effects: [], tools: [instruction], dataKinds: [order] })).toEqual([])
    })

    it("asks the grant to name each tool and cover its rights", () => {
        const index = nodeIndexOf({ nodes: [caller], effects: [], tools: [instruction], dataKinds: [order] })
        const ref = { key: "k", kind: "execute", step: "payment.caller" }
        const all = ["payment.instruction", "payment.charge", "payment.ghost"]
        expect(graphNodeProblems(ref, index, { rights: [READ], tools: all })).toEqual([])
        expect(graphNodeProblems(ref, index, { rights: [], tools: all })).toEqual([
            { code: "NODE_RIGHTS_UNGRANTED", at: "k" },
        ])
        expect(graphNodeProblems(ref, index, { rights: [READ] })).toEqual([{ code: "NODE_RIGHTS_UNGRANTED", at: "k" }])
    })
})

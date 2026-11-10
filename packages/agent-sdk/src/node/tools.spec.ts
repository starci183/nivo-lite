import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import type { DataRight } from "../rights/rights.types"
import { EXAMPLE_TURN, nodeExampleMismatches } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import type { ToolDefinition } from "./effect.types"
import { defineDataKind, defineTool } from "./effect"
import { callDigestOf, runNode } from "./host"
import type { NodeRunRequest } from "./host.types"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { graphNodeProblems, nodeIndexOf, nodeListProblems } from "./problems"
import { RightsDeniedError } from "./rights-denied-error"
import { ToolUndeclaredError } from "./tool-undeclared-error"
import { trusted } from "../schema/trusted"

const READ: DataRight = { kind: "order", access: "read", scope: "turn", fields: ["id"] }

const instruction = defineTool({
    id: "payment.quote",
    title: { key: "i" },
    args: z.object({ orderNo: z.string().max(200) }),
    result: z.object({ qrUrl: z.string().max(200) }),
    mutates: false,
    rights: [READ],
})

const charge = defineTool({ ...instruction, id: "payment.charge", mutates: true, rights: [] })

/** A node that calls the tool its input names. */
const caller = trusted<NodeDefinition>(
    defineNode({
        id: "payment.caller",
        role: "execute",
        title: { key: "c" },
        params: z.object({}),
        input: z.object({ tool: z.string().max(200), orderNo: z.union([z.string().max(200), z.number()]) }),
        output: z.object({ qrUrl: z.string().max(200) }),
        rights: [],
        effects: [],
        tools: ["payment.quote", "payment.charge", "payment.ghost"],
        run: (input, context) =>
            context.tools.call<{ qrUrl: string }>(trusted<"a.b">(input.tool), { orderNo: input.orderNo }),
        examples: [
            {
                name: "asks",
                params: {},
                input: { tool: "payment.quote", orderNo: "A1" },
                output: { qrUrl: "q" },
                effects: [],
                tools: [{ qrUrl: "q" }],
                grant: { rights: [READ], tools: ["payment.quote"] },
            },
        ],
    }),
)

const tools = trusted<NodeRunRequest["tools"]>(
    new Map([
        [instruction.id, instruction],
        [charge.id, charge],
    ]),
)

const requestOf = (tool: string, overrides: Partial<NodeRunRequest> = {}): NodeRunRequest => ({
    node: caller,
    params: {},
    input: { tool, orderNo: "A1" },
    turn: EXAMPLE_TURN,
    grant: { rights: [READ], tools: ["payment.quote", "payment.charge"] },
    effects: new Map(),
    tools,
    key: "run-1:step",
    ...overrides,
})

describe("defineTool", () => {
    it("defines a tool and refuses a malformed tool id on a node", () => {
        expect(instruction.entry).toBe("tool")
        expect(() => defineTool({ ...instruction, id: trusted<"a.b">("Bad") })).toThrow(SdkDefinitionError)
        expect(() => defineNode(trusted<never>({ ...caller, tools: ["Bad.x"] }))).toThrow(SdkDefinitionError)
    })
})

describe("runNode tools", () => {
    it("calls a declared, installed, granted tool with parsed args and a keyed call", async () => {
        const fake = scriptedNodePorts({ tools: [{ qrUrl: "q" }] })
        await expect(runNode(requestOf("payment.quote"), fake.ports)).resolves.toEqual({
            output: { qrUrl: "q" },
            effects: [],
        })
        expect(fake.toolCalls).toEqual([
            {
                id: "payment.quote",
                args: { orderNo: "A1" },
                key: `run-1:step:tool:${callDigestOf("payment.quote", { orderNo: "A1" })}`,
            },
        ])
    })

    it("refuses an undeclared, uninstalled or ungranted tool", async () => {
        const { ports } = scriptedNodePorts({ tools: [{ qrUrl: "q" }] })
        await expect(runNode(requestOf("payment.other"), ports)).rejects.toThrow(ToolUndeclaredError)
        const toolless = trusted<NodeDefinition>({ ...caller, tools: undefined })
        await expect(runNode(requestOf("payment.quote", { node: toolless }), ports)).rejects.toThrow(
            ToolUndeclaredError,
        )
        await expect(runNode(requestOf("payment.ghost"), ports)).rejects.toThrow("TOOL_UNKNOWN")
        const unnamed = { rights: [READ] }
        await expect(runNode(requestOf("payment.quote", { grant: unnamed }), ports)).rejects.toThrow(
            RightsDeniedError,
        )
        const rightless = { rights: [], tools: ["payment.quote"] }
        await expect(runNode(requestOf("payment.quote", { grant: rightless }), ports)).rejects.toThrow(
            RightsDeniedError,
        )
    })

    it("refuses bad args, a bad answer, an unscripted call, and a mutating tool from a condition", async () => {
        await expect(
            runNode(
                requestOf("payment.quote", { input: { tool: "payment.quote", orderNo: 1 } }),
                scriptedNodePorts().ports,
            ),
        ).rejects.toThrow("TOOL_ARGS_INVALID")
        await expect(runNode(requestOf("payment.charge"), scriptedNodePorts({ tools: [{}] }).ports)).rejects.toThrow(
            "TOOL_RESULT_INVALID",
        )
        await expect(runNode(requestOf("payment.charge"), scriptedNodePorts().ports)).rejects.toThrow("TOOL_UNSCRIPTED")
        const condition = trusted<NodeDefinition>({ ...caller, role: "condition" })
        await expect(
            runNode(requestOf("payment.charge", { node: condition }), scriptedNodePorts().ports),
        ).rejects.toThrow("TOOL_MUTATES")
    })

    it("refuses args that parse to something other than a record", async () => {
        const plain = trusted<ToolDefinition>(
            defineTool({
                ...instruction,
                id: "payment.ghost",
                args: z.object({ orderNo: z.string().max(200) }).transform((args) => args.orderNo),
            }),
        )
        const asked = requestOf("payment.ghost", {
            tools: new Map([[plain.id, plain]]),
            grant: { rights: [READ], tools: ["payment.ghost"] },
        })
        await expect(runNode(asked, scriptedNodePorts().ports)).rejects.toThrow("TOOL_ARGS_INVALID")
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
    const condition = trusted<NodeDefinition>({ ...caller, id: "payment.check", role: "condition" })

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
            { code: "RIGHT_KIND_UNKNOWN", at: "payment.quote:order" },
        ])
        expect(nodeListProblems({ nodes: [], effects: [], tools: [instruction], dataKinds: [order] })).toEqual([])
    })

    it("asks the grant to name each tool and cover its rights", () => {
        const index = nodeIndexOf({ nodes: [caller], effects: [], tools: [instruction], dataKinds: [order] })
        const ref = { key: "k", kind: "execute", step: "payment.caller" }
        const all = ["payment.quote", "payment.charge", "payment.ghost"]
        expect(graphNodeProblems(ref, index, { rights: [READ], tools: all })).toEqual([])
        expect(graphNodeProblems(ref, index, { rights: [], tools: all })).toEqual([
            { code: "NODE_RIGHTS_UNGRANTED", at: "k" },
        ])
        expect(graphNodeProblems(ref, index, { rights: [READ] })).toEqual([{ code: "NODE_RIGHTS_UNGRANTED", at: "k" }])
    })
})

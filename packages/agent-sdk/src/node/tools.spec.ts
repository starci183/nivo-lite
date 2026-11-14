import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import { EXAMPLE_TURN, nodeExampleMismatches } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import type { ToolDefinition } from "./effect.types"
import { defineDataKind, defineTool } from "./effect"
import { callDigestOf } from "./call-digest"
import { runNode } from "./host"
import type { NodeRunRequest } from "./host.types"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { graphNodeProblems, nodeIndexOf, nodeListProblems } from "./problems"
import { RightsDeniedError } from "./rights-denied-error"
import { ToolUndeclaredError } from "./tool-undeclared-error"
import { trusted } from "../schema/trusted"

const instruction = defineTool({
    id: "payment.quote",
    title: { key: "i" },
    args: z.object({ orderNo: z.string().max(200) }),
    result: z.object({ qrUrl: z.string().max(200) }),
    mutates: false,
})

const charge = defineTool({ ...instruction, id: "payment.charge", mutates: true })

/** A node that calls the tool its input names. */
const caller = trusted<NodeDefinition>(
    defineNode({
        id: "payment.caller",
        role: "execute",
        title: { key: "c" },
        params: z.object({}),
        input: z.object({ tool: z.string().max(200), orderNo: z.union([z.string().max(200), z.number()]) }),
        output: z.object({ qrUrl: z.string().max(200) }),
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
                grant: { tools: ["payment.quote"] },
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
    grant: { tools: ["payment.quote", "payment.charge"] },
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
                key: `run-1:step:${callDigestOf("payment.quote", { orderNo: "A1" })}`,
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
        await expect(runNode(requestOf("payment.quote", { grant: {} }), ports)).rejects.toThrow(RightsDeniedError)
        await expect(
            runNode(requestOf("payment.quote", { grant: { tools: ["payment.quote"] } }), ports),
        ).resolves.toMatchObject({ output: { qrUrl: "q" } })
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
            grant: { tools: ["payment.ghost"] },
        })
        await expect(runNode(asked, scriptedNodePorts().ports)).rejects.toThrow("TOOL_ARGS_INVALID")
    })

    it("runs an example with scripted tool results, granting the node's own tools by default", async () => {
        const [example] = caller.examples
        await expect(nodeExampleMismatches(caller, example, [], [instruction])).resolves.toEqual([])
        const { grant: _grant, ...defaulted } = example
        await expect(nodeExampleMismatches(caller, defaulted, [], [instruction])).resolves.toEqual([])
    })
})

describe("tool problems", () => {
    const order = defineDataKind({ kind: "order", title: { key: "o" }, fields: z.object({ id: z.string().max(200) }) })
    const condition = trusted<NodeDefinition>({ ...caller, id: "payment.check", role: "condition" })

    it("names an unknown tool, a mutating tool in a condition and a duplicate", () => {
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
        ])
        expect(nodeListProblems({ nodes: [], effects: [], tools: [instruction], dataKinds: [order] })).toEqual([])
    })

    it("asks the grant to name each tool the node declares, and nothing else", () => {
        const index = nodeIndexOf({ nodes: [caller], effects: [], tools: [instruction], dataKinds: [order] })
        const ref = { key: "k", kind: "execute", step: "payment.caller" }
        const all = ["payment.quote", "payment.charge", "payment.ghost"]
        expect(graphNodeProblems(ref, index, { tools: all })).toEqual([])
        expect(graphNodeProblems(ref, index, { tools: ["payment.quote"] })).toEqual([
            { code: "NODE_TOOLS_UNGRANTED", at: "k" },
        ])
        expect(graphNodeProblems(ref, index, {})).toEqual([{ code: "NODE_TOOLS_UNGRANTED", at: "k" }])
    })
})

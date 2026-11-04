import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import { rightsGaps } from "../rights/rights"
import type { DataRight } from "../rights/rights.types"
import { EXAMPLE_TURN } from "../testing/node-examples"
import { scriptedNodePorts } from "../testing/node-ports"
import { defineDataKind, defineEffect } from "./effect"
import { runNode } from "./host"
import type { NodeRunRequest } from "./host.types"
import { defineNode } from "./node"
import { NodeRunError } from "./node-run-error"
import type { NodeContext, NodeDefinition } from "./node.types"
import { RightsDeniedError } from "./rights-denied-error"
import { trusted } from "../schema/trusted"

const READ_ORDERS: DataRight = { kind: "order", access: "read", scope: "turn", fields: ["id", "total"] }
const WRITE_ORDERS: DataRight = { kind: "order", access: "write", scope: "turn", fields: ["id", "total"] }
const READ_ALL: DataRight = { kind: "order", access: "read", scope: "workspace", fields: ["id"] }

const notify = defineEffect({
    id: "order.notify",
    title: { key: "n" },
    payload: z.object({ text: z.string().max(200) }),
    rights: [READ_ORDERS],
})

/** A node whose run does what its input says, so one definition drives every host path. */
const probe = defineNode({
    id: "order.probe",
    role: "execute",
    title: { key: "t" },
    params: z.object({ prefix: z.string().max(200) }),
    input: z.object({ act: z.string().max(200) }),
    output: z.object({ said: z.string().max(200) }),
    rights: [READ_ORDERS, WRITE_ORDERS],
    effects: ["order.notify", "order.ghost"],
    run: async (input, context) => {
        if (input.act === "read") {
            const rows = await context.data.read<{ total: number }>("order", { fields: ["total"], where: { id: "o1" } })
            return { said: `${context.params.prefix}${rows[0]?.total ?? 0}` }
        }
        if (input.act === "read-none") await context.data.read("order", { fields: [] })
        if (input.act === "read-wide") await context.data.read("order", { fields: ["secret"] })
        if (input.act === "write") return { said: (await context.data.write("order", { total: 1 })).id }
        if (input.act === "write-wide") await context.data.write("order", { secret: 1 })
        if (input.act === "effect") return { said: (await context.effect("order.notify", { text: "hi" })).id }
        if (input.act === "effect-once") {
            return { said: (await context.effect("order.notify", { text: "hi" }, { dedupeKey: "notify:o1" })).id }
        }
        if (input.act === "effect-bad") await context.effect("order.notify", { text: 1 })
        if (input.act === "effect-ghost") await context.effect("order.ghost", {})
        if (input.act === "effect-undeclared") await context.effect("order.other", {})
        if (input.act === "model") {
            const text = await context.model.text({ purpose: "p", instructions: "i", input: null })
            const json = await context.model.json(z.object({ n: z.number() }), {
                purpose: "p",
                instructions: "",
                input: 1,
            })
            return { said: `${text}${json.n}${context.now().getTime()}${context.turn.turnId}` }
        }
        return input.act === "bad-output" ? trusted<{ said: string }>({ said: 1 }) : { said: "" }
    },
    examples: [{ name: "one", params: { prefix: "" }, input: { act: "" }, output: { said: "" }, effects: [] }],
})

const requestOf = (act: string, overrides: Partial<NodeRunRequest> = {}): NodeRunRequest => ({
    node: trusted<NodeDefinition>(probe),
    params: { prefix: "#" },
    input: { act },
    turn: EXAMPLE_TURN,
    grant: { rights: [READ_ORDERS, WRITE_ORDERS] },
    effects: new Map([[notify.id, trusted<typeof notify>(notify)]]),
    tools: new Map(),
    key: "run-1:step",
    ...overrides,
})

describe("defineNode", () => {
    it("refuses a malformed node or effect id, and a condition without a branch", () => {
        const config = {
            role: "output",
            title: { key: "t" },
            params: z.object({}),
            input: z.object({}),
            output: z.object({}),
            rights: [],
            run: () => Promise.resolve(trusted<never>({})),
            examples: [{ name: "e", params: {}, input: {}, output: trusted<never>({}), effects: [] }],
        } as const
        expect(() => defineNode({ ...config, id: "Bad.x", effects: [] })).toThrow(SdkDefinitionError)
        expect(() => defineNode({ ...config, id: "ok.node", effects: ["Bad.x"] })).toThrow(SdkDefinitionError)
        expect(() => defineNode({ ...config, role: "condition", id: "ok.node", effects: [] })).toThrow(
            "NODE_CONDITION_BRANCH",
        )
        expect(() =>
            defineNode({ ...config, role: "condition", id: "ok.node", output: z.string().max(200), effects: [] }),
        ).toThrow("NODE_CONDITION_BRANCH")
        const output = z.object({ branch: z.string().max(200) })
        expect(() =>
            defineNode({ ...config, role: "condition", id: "ok.node", output, effects: ["ok.effect"] }),
        ).toThrow("NODE_CONDITION_EFFECTS")
        expect(defineNode({ ...config, role: "condition", id: "ok.node", output, effects: [] }).entry).toBe("node")
    })
})

describe("defineEffect and defineDataKind", () => {
    it("define an effect and a data kind with its field names, and refuse malformed names", () => {
        expect(notify.entry).toBe("effect")
        expect(() => defineEffect({ ...notify, id: trusted<"a.b">("bad") })).toThrow(SdkDefinitionError)
        const kind = defineDataKind({
            kind: "order",
            title: { key: "o" },
            fields: z.object({ id: z.string().max(200) }),
        })
        expect(kind.fieldNames).toEqual(["id"])
        expect(() => defineDataKind({ ...kind, kind: "Order" })).toThrow("DATA_KIND_MALFORMED")
    })
})

describe("runNode", () => {
    it("parses params and input, reads within the rights, and parses the output", async () => {
        const fake = scriptedNodePorts({ store: { order: [{ id: "o1", total: 5 }] } })
        await expect(runNode(requestOf("read"), fake.ports)).resolves.toEqual({ output: { said: "#5" }, effects: [] })
    })

    it("refuses bad params, bad input and bad output", async () => {
        const { ports } = scriptedNodePorts()
        await expect(runNode(requestOf("", { params: {} }), ports)).rejects.toThrow("PARAMS_INVALID")
        await expect(runNode(requestOf("", { input: {} }), ports)).rejects.toThrow("INPUT_INVALID")
        await expect(runNode(requestOf("bad-output"), ports)).rejects.toThrow(NodeRunError)
    })

    it("refuses an agent whose grant misses a right the node requires", async () => {
        const { ports } = scriptedNodePorts()
        await expect(runNode(requestOf("", { grant: { rights: [READ_ORDERS] } }), ports)).rejects.toThrow(
            RightsDeniedError,
        )
    })

    it("refuses reads and writes without fields or outside the declared rights", async () => {
        const { ports } = scriptedNodePorts()
        await expect(runNode(requestOf("read-none"), ports)).rejects.toThrow(RightsDeniedError)
        await expect(runNode(requestOf("read-wide"), ports)).rejects.toThrow(RightsDeniedError)
        await expect(runNode(requestOf("write-wide"), ports)).rejects.toThrow(RightsDeniedError)
    })

    it("reads in the workspace scope only when the node declares it and the grant holds it", async () => {
        const wide = trusted<NodeDefinition>({ ...probe, rights: [READ_ALL] })
        const read = jest.fn().mockResolvedValue([])
        const { ports } = scriptedNodePorts()
        const node = trusted<NodeDefinition>({
            ...wide,
            run: async (_: unknown, context: NodeContext) => {
                await context.data.read("order", { fields: ["id"] })
                return { said: "" }
            },
        })
        await runNode(requestOf("", { node, grant: { rights: [READ_ALL] } }), { ...ports, read })
        expect(read).toHaveBeenCalledWith("order", { fields: ["id"] }, "workspace")
        await expect(
            runNode(requestOf("", { node, grant: { rights: [{ ...READ_ALL, scope: "turn" }] } }), ports),
        ).rejects.toThrow(RightsDeniedError)
    })

    it("writes through the port", async () => {
        const fake = scriptedNodePorts()
        await expect(runNode(requestOf("write"), fake.ports)).resolves.toMatchObject({ output: { said: "order-1" } })
        expect(fake.writes).toEqual([{ kind: "order", record: { total: 1 } }])
    })

    it("runs a declared, installed, granted effect with a keyed payload and records it", async () => {
        const fake = scriptedNodePorts()
        await expect(runNode(requestOf("effect"), fake.ports)).resolves.toEqual({
            output: { said: "order.notify-1" },
            effects: [{ id: "order.notify", subject: { kind: "order.notify", id: "order.notify-1" } }],
        })
        expect(fake.executed).toEqual([
            { id: "order.notify", payload: { text: "hi" }, key: "run-1:step:0", dedupeKey: null },
        ])
        await runNode(requestOf("effect-once"), fake.ports)
        expect(fake.executed[1]).toMatchObject({ key: "run-1:step:0", dedupeKey: "notify:o1" })
    })

    it("refuses an undeclared, uninstalled, ill-formed or ungranted effect", async () => {
        const { ports } = scriptedNodePorts()
        await expect(runNode(requestOf("effect-undeclared"), ports)).rejects.toThrow("EFFECT_UNDECLARED")
        await expect(runNode(requestOf("effect-ghost"), ports)).rejects.toThrow("EFFECT_UNKNOWN")
        await expect(runNode(requestOf("effect-bad"), ports)).rejects.toThrow("EFFECT_PAYLOAD_INVALID")
        const locked = defineEffect({ ...notify, rights: [READ_ALL] })
        const effects = new Map([[locked.id, trusted<typeof notify>(locked)]])
        await expect(runNode(requestOf("effect", { effects }), ports)).rejects.toThrow(RightsDeniedError)
    })

    it("asks the model under the node's id and tells the time", async () => {
        const fake = scriptedNodePorts({ model: ["a", { n: 2 }], now: new Date(7) })
        const text = jest.spyOn(fake.ports.model, "text")
        await expect(runNode(requestOf("model"), fake.ports)).resolves.toMatchObject({ output: { said: "a27turn-1" } })
        expect(text).toHaveBeenCalledWith({ purpose: "order.probe:p", instructions: "i", input: null })
    })
})

describe("scriptedNodePorts", () => {
    it("refuses a model call the script did not hold, and a text answer that is no text", async () => {
        await expect(runNode(requestOf("model"), scriptedNodePorts().ports)).rejects.toThrow("MODEL_UNSCRIPTED")
        await expect(runNode(requestOf("model"), scriptedNodePorts({ model: [1] }).ports)).rejects.toThrow(
            "MODEL_UNSCRIPTED",
        )
    })

    it("limits rows and reads nothing from an empty store", async () => {
        const { ports } = scriptedNodePorts({ store: { order: [{ id: "1" }, { id: "2" }] } })
        await expect(ports.read("order", { fields: ["id"], limit: 1 }, "turn")).resolves.toEqual([{ id: "1" }])
        await expect(scriptedNodePorts().ports.read("order", { fields: ["id"] }, "turn")).resolves.toEqual([])
        expect(scriptedNodePorts().ports.now().getTime()).toBe(0)
    })
})

describe("rightsGaps", () => {
    const held: DataRight = { kind: "order", access: "read", scope: "workspace", fields: ["id", "total"] }

    it("is empty when covered, and workspace covers turn", () => {
        expect(rightsGaps({ rights: [held] }, [READ_ORDERS])).toEqual([])
    })

    it("names a missing kind, access, scope and fields", () => {
        expect(rightsGaps({ rights: [] }, [READ_ORDERS])[0]?.missing).toBe("kind")
        expect(rightsGaps({ rights: [{ ...held, access: "write" }] }, [READ_ORDERS])[0]?.missing).toBe("access")
        expect(
            rightsGaps({ rights: [{ ...held, scope: "turn" }] }, [{ ...READ_ORDERS, scope: "workspace" }])[0]?.missing,
        ).toBe("scope")
        expect(rightsGaps({ rights: [held] }, [{ ...READ_ORDERS, fields: ["id", "secret"] }])[0]?.missing).toEqual([
            "secret",
        ])
        const two = [
            { ...held, access: "write" as const },
            { ...held, scope: "turn" as const },
        ]
        expect(rightsGaps({ rights: two }, [{ ...READ_ORDERS, scope: "workspace" }])[0]?.missing).toBe("access")
    })
})

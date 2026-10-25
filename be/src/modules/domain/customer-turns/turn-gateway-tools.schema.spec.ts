import type { GatewayJson } from "@modules/domain/mcp-gateway"
import {
    gatewaySequenceStepsSchema,
    turnGatewayCallSchema,
    turnGatewaySequenceSchema,
} from "./turn-gateway-tools.schema"

const nestedArguments = (depth: number): GatewayJson =>
    depth === 0 ? { value: 1 } : { value: nestedArguments(depth - 1) }

describe("turn gateway call schema", () => {
    it("accepts a named tool with bounded encoded arguments, or no encoded arguments", () => {
        expect(turnGatewayCallSchema.parse({ name: "crm.order.place", arguments_json: '{"qty":2}' })).toEqual({
            name: "crm.order.place",
            arguments_json: '{"qty":2}',
        })
        expect(turnGatewayCallSchema.parse({ name: "crm.stock.read" })).toEqual({ name: "crm.stock.read" })
        expect(
            turnGatewayCallSchema.safeParse({ name: "n".repeat(113), arguments_json: " ".repeat(65536) }).success,
        ).toBe(true)
    })

    it.each([
        { label: "long name", args: { name: "n".repeat(114) } },
        { label: "long JSON text", args: { name: "crm.order.place", arguments_json: " ".repeat(65537) } },
        { label: "empty name", args: { name: "" } },
        { label: "numeric name", args: { name: 3 } },
        { label: "object JSON text", args: { name: "crm.order.place", arguments_json: {} } },
        { label: "extra argument", args: { name: "crm.order.place", extra: true } },
        { label: "missing name", args: {} },
        { label: "null arguments", args: null },
        { label: "array arguments", args: [] },
    ])("rejects $label", ({ args }) => {
        expect(turnGatewayCallSchema.safeParse(args).success).toBe(false)
    })
})

describe("turn gateway sequence schema", () => {
    it("accepts an encoded playbook with an optional bounded reply", () => {
        const args = { steps_json: '[{"name":"crm.stock.read"}]', reply: "Done for you" }
        expect(turnGatewaySequenceSchema.parse(args)).toEqual(args)
        expect(turnGatewaySequenceSchema.safeParse({ steps_json: args.steps_json }).success).toBe(true)
        expect(
            turnGatewaySequenceSchema.safeParse({ steps_json: " ".repeat(655360), reply: "r".repeat(2000) }).success,
        ).toBe(true)
    })

    it.each([
        { label: "long steps text", args: { steps_json: " ".repeat(655361) } },
        { label: "long reply", args: { steps_json: "[]", reply: "r".repeat(2001) } },
        { label: "array steps text", args: { steps_json: [] } },
        { label: "numeric reply", args: { steps_json: "[]", reply: 3 } },
        { label: "extra argument", args: { steps_json: "[]", extra: true } },
        { label: "missing steps", args: {} },
        { label: "null arguments", args: null },
        { label: "array arguments", args: [] },
    ])("rejects $label", ({ args }) => {
        expect(turnGatewaySequenceSchema.safeParse(args).success).toBe(false)
    })
})

describe("gateway sequence steps schema", () => {
    it("accepts one to ten named calls with bounded JSON arguments", () => {
        const step = { name: "crm.stock.read", arguments: { sku: "a", flags: [true, null, 2] } }
        expect(gatewaySequenceStepsSchema.parse([step, { name: "crm.order.place" }])).toEqual([
            step,
            { name: "crm.order.place" },
        ])
        expect(gatewaySequenceStepsSchema.safeParse(Array.from({ length: 10 }, () => step)).success).toBe(true)
    })

    it.each([
        { label: "empty steps", steps: [] },
        { label: "too many steps", steps: Array.from({ length: 11 }, () => ({ name: "crm.stock.read" })) },
        { label: "long step name", steps: [{ name: "n".repeat(114) }] },
        { label: "empty step name", steps: [{ name: "" }] },
        { label: "long argument string", steps: [{ name: "crm.stock.read", arguments: { key: "v".repeat(8193) } }] },
        {
            label: "too many argument items",
            steps: [{ name: "crm.stock.read", arguments: { list: Array.from({ length: 101 }, () => 1) } }],
        },
        {
            label: "too many argument properties",
            steps: [
                {
                    name: "crm.stock.read",
                    arguments: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [String(i), 1])),
                },
            ],
        },
        {
            label: "long argument key",
            steps: [{ name: "crm.stock.read", arguments: { ["k".repeat(101)]: 1 } }],
        },
        {
            label: "deep arguments",
            steps: [{ name: "crm.stock.read", arguments: nestedArguments(9) }],
        },
        {
            label: "large encoded arguments",
            steps: [
                {
                    name: "crm.stock.read",
                    arguments: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i), "x".repeat(8192)])),
                },
            ],
        },
        { label: "numeric step name", steps: [{ name: 3 }] },
        { label: "array step arguments", steps: [{ name: "crm.stock.read", arguments: [] }] },
        { label: "null step arguments", steps: [{ name: "crm.stock.read", arguments: null }] },
        { label: "extra step property", steps: [{ name: "crm.stock.read", extra: true }] },
        { label: "object steps", steps: {} },
        { label: "null steps", steps: null },
    ])("rejects $label", ({ steps }) => {
        expect(gatewaySequenceStepsSchema.safeParse(steps).success).toBe(false)
    })
})

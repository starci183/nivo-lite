import assert from "node:assert/strict"
import { parseJsonText } from "@modules/platform/primitives"
import { GATEWAY_ARGUMENT_LIMITS } from "./gateway-arguments.policy"
import {
    GATEWAY_CALL_INPUT_SCHEMA,
    gatewayArgumentsSchema,
    gatewayCallSchema,
    gatewayDescribeSchema,
    gatewaySearchSchema,
} from "./gateway-tools.schema"
import type { GatewayInputSchema } from "./gateway-tools.schema"
import type { GatewayArgument, GatewayJson } from "./mcp-gateway.contracts"

const TOOL_NAME = "sepay.transactions.list"

/** Resolve the local references of the advertised schema before inspecting a field's declared bounds. */
const resolvedSchema = (schema: GatewayInputSchema | boolean | undefined): GatewayInputSchema => {
    assert(typeof schema === "object" && schema !== null, "the advertised schema node is missing")
    if (schema.$ref === undefined) return schema
    assert(schema.$ref.startsWith("#/$defs/"), "the advertised schema reference is not local")
    const resolved = GATEWAY_CALL_INPUT_SCHEMA.$defs?.[schema.$ref.slice("#/$defs/".length)]
    assert(typeof resolved === "object" && resolved !== null, "the advertised schema reference does not resolve")
    return resolved
}

/** A JSON object whose serialized length reaches one budget independently of the per-string limit. */
const argumentsOfLength = (length: number): GatewayJson => {
    const head = Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [`item${String(index)}`, "x".repeat(GATEWAY_ARGUMENT_LIMITS.string)]),
    )
    const padding = length - JSON.stringify({ ...head, tail: "" }).length
    return { ...head, tail: "x".repeat(padding) }
}

/** An argument tree with exactly the requested number of containers below the root object. */
const nestedAt = (depth: number, kind: "array" | "object"): GatewayArgument => {
    let value: GatewayArgument = "leaf"
    for (let level = 0; level < depth; level += 1) value = kind === "array" ? [value] : { child: value }
    return value
}

describe("tool.search argument schema", () => {
    it("accepts a valid call, an empty query and the declared boundaries", () => {
        expect(gatewaySearchSchema.parse({ query: "bank credits", limit: 3 })).toEqual({
            query: "bank credits",
            limit: 3,
        })
        expect(gatewaySearchSchema.parse({ query: "" })).toEqual({ query: "" })
        expect(gatewaySearchSchema.safeParse({ query: "x".repeat(200), limit: 10 }).success).toBe(true)
        expect(gatewaySearchSchema.safeParse({ query: "bank", limit: 1 }).success).toBe(true)
    })

    it.each([
        ["query length", { query: "x".repeat(201) }],
        ["minimum limit", { query: "bank", limit: 0 }],
        ["maximum limit", { query: "bank", limit: 11 }],
        ["integer limit", { query: "bank", limit: 1.5 }],
        ["required query", {}],
        ["query type", { query: 7 }],
        ["query null", { query: null }],
        ["limit type", { query: "bank", limit: "5" }],
        ["limit null", { query: "bank", limit: null }],
        ["undeclared arguments", { query: "bank", extra: true }],
        ["argument object type", []],
        ["argument object null", null],
    ])("rejects invalid %s", (_label, args) => {
        expect(gatewaySearchSchema.safeParse(args).success).toBe(false)
    })
})

describe("tool.describe argument schema", () => {
    it("accepts a valid call and the name length boundaries", () => {
        expect(gatewayDescribeSchema.parse({ name: TOOL_NAME })).toEqual({ name: TOOL_NAME })
        expect(gatewayDescribeSchema.safeParse({ name: "x" }).success).toBe(true)
        expect(gatewayDescribeSchema.safeParse({ name: "x".repeat(113) }).success).toBe(true)
    })

    it.each([
        ["minimum name length", { name: "" }],
        ["maximum name length", { name: "x".repeat(114) }],
        ["required name", {}],
        ["name type", { name: 7 }],
        ["name null", { name: null }],
        ["undeclared arguments", { name: TOOL_NAME, extra: true }],
        ["argument object type", []],
        ["argument object null", null],
    ])("rejects invalid %s", (_label, args) => {
        expect(gatewayDescribeSchema.safeParse(args).success).toBe(false)
    })
})

describe("tool.call argument schema", () => {
    it("accepts a valid call, omitted arguments and the name length boundaries", () => {
        expect(gatewayCallSchema.parse({ name: TOOL_NAME, arguments: { limit: 5 } })).toEqual({
            name: TOOL_NAME,
            arguments: { limit: 5 },
        })
        expect(gatewayCallSchema.parse({ name: TOOL_NAME })).toEqual({ name: TOOL_NAME })
        expect(gatewayCallSchema.safeParse({ name: "x" }).success).toBe(true)
        expect(gatewayCallSchema.safeParse({ name: "x".repeat(113) }).success).toBe(true)
        expect(gatewayCallSchema.parse({ name: TOOL_NAME, opKey: "k".repeat(200) })).toEqual({
            name: TOOL_NAME,
            opKey: "k".repeat(200),
        })
    })

    it.each([
        ["minimum name length", { name: "" }],
        ["maximum name length", { name: "x".repeat(114) }],
        ["maximum operation key length", { name: TOOL_NAME, opKey: "k".repeat(201) }],
        ["operation key type", { name: TOOL_NAME, opKey: 7 }],
        ["operation key null", { name: TOOL_NAME, opKey: null }],
        ["required name", {}],
        ["name type", { name: 7 }],
        ["name null", { name: null }],
        ["undeclared arguments", { name: TOOL_NAME, extra: true }],
        ["argument object type", []],
        ["argument object null", null],
    ])("rejects invalid %s", (_label, args) => {
        expect(gatewayCallSchema.safeParse(args).success).toBe(false)
    })
})

describe("connector JSON argument schema valid values", () => {
    it("accepts JSON scalar values, arrays and nested records", () => {
        const args = { text: "value", number: 2.5, yes: true, empty: null, nested: { list: ["a", 1, false, null] } }

        expect(gatewayArgumentsSchema.parse(args)).toEqual(args)
        expect(gatewayCallSchema.parse({ name: TOOL_NAME, arguments: args })).toEqual({
            name: TOOL_NAME,
            arguments: args,
        })
    })

    it.each([
        ["string length", { value: "x".repeat(GATEWAY_ARGUMENT_LIMITS.string) }],
        ["record key length", { ["x".repeat(GATEWAY_ARGUMENT_LIMITS.key)]: true }],
        ["array count", { values: Array.from({ length: GATEWAY_ARGUMENT_LIMITS.items }, () => null) }],
        [
            "record property count",
            Object.fromEntries(
                Array.from({ length: GATEWAY_ARGUMENT_LIMITS.properties }, (_, index) => [String(index), null]),
            ),
        ],
        ["nested object depth", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth, "object") }],
        ["nested array depth", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth, "array") }],
    ])("accepts the %s boundary", (_label, args) => {
        expect(gatewayArgumentsSchema.safeParse(args).success).toBe(true)
        expect(gatewayCallSchema.safeParse({ name: TOOL_NAME, arguments: args }).success).toBe(true)
    })

    it("accepts the exact total JSON length budget and rejects one more character", () => {
        const within = argumentsOfLength(GATEWAY_ARGUMENT_LIMITS.json)
        const over = argumentsOfLength(GATEWAY_ARGUMENT_LIMITS.json + 1)

        expect(JSON.stringify(within)).toHaveLength(GATEWAY_ARGUMENT_LIMITS.json)
        expect(JSON.stringify(over)).toHaveLength(GATEWAY_ARGUMENT_LIMITS.json + 1)
        expect(gatewayArgumentsSchema.safeParse(within).success).toBe(true)
        expect(gatewayCallSchema.safeParse({ name: TOOL_NAME, arguments: within }).success).toBe(true)
        expect(gatewayArgumentsSchema.safeParse(over).success).toBe(false)
        expect(gatewayCallSchema.safeParse({ name: TOOL_NAME, arguments: over }).success).toBe(false)
    })
})

describe("connector JSON argument schema exceeded bounds", () => {
    it.each([
        ["string length", { value: "x".repeat(GATEWAY_ARGUMENT_LIMITS.string + 1) }],
        ["nested string length", { nested: { value: "x".repeat(GATEWAY_ARGUMENT_LIMITS.string + 1) } }],
        ["record key length", { ["x".repeat(GATEWAY_ARGUMENT_LIMITS.key + 1)]: true }],
        ["nested record key length", { nested: { ["x".repeat(GATEWAY_ARGUMENT_LIMITS.key + 1)]: true } }],
        ["array count", { values: Array.from({ length: GATEWAY_ARGUMENT_LIMITS.items + 1 }, () => null) }],
        [
            "nested array count",
            { nested: { values: Array.from({ length: GATEWAY_ARGUMENT_LIMITS.items + 1 }, () => null) } },
        ],
        [
            "record property count",
            Object.fromEntries(
                Array.from({ length: GATEWAY_ARGUMENT_LIMITS.properties + 1 }, (_, index) => [String(index), null]),
            ),
        ],
        [
            "nested record property count",
            {
                nested: Object.fromEntries(
                    Array.from({ length: GATEWAY_ARGUMENT_LIMITS.properties + 1 }, (_, index) => [String(index), null]),
                ),
            },
        ],
        ["object depth", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth + 1, "object") }],
        ["array depth", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth + 1, "array") }],
    ])("rejects exceeded %s", (_label, args) => {
        expect(gatewayArgumentsSchema.safeParse(args).success).toBe(false)
        expect(gatewayCallSchema.safeParse({ name: TOOL_NAME, arguments: args }).success).toBe(false)
    })
})

describe("connector JSON argument schema wrong types", () => {
    it.each([
        ["root array", []],
        ["root null", null],
        ["root text", "arguments"],
        ["root number", 7],
        ["root boolean", true],
        ["undefined member", { value: undefined }],
        ["function member", { value: () => "text" }],
        ["symbol member", { value: Symbol("value") }],
        ["bigint member", { value: BigInt(7) }],
        ["NaN member", { value: Number.NaN }],
        ["infinite member", { value: Number.POSITIVE_INFINITY }],
        ["date member", { value: new Date("2026-10-01T00:00:00Z") }],
        ["map member", { value: new Map([["key", "value"]]) }],
        ["undefined array member", { value: [undefined] }],
    ])("rejects a non-JSON %s", (_label, args) => {
        expect(gatewayArgumentsSchema.safeParse(args).success).toBe(false)
        expect(gatewayCallSchema.safeParse({ name: TOOL_NAME, arguments: args }).success).toBe(false)
    })
})

describe("connector JSON argument schema prototype keys", () => {
    it.each([
        ["a valid scalar", '{"__proto__":7}'],
        ["a non-finite number", '{"__proto__":1e400}'],
        ["an oversized string", `{"__proto__":"${"x".repeat(GATEWAY_ARGUMENT_LIMITS.string + 1)}"}`],
        [
            "an oversized array",
            `{"__proto__":${JSON.stringify(Array.from({ length: GATEWAY_ARGUMENT_LIMITS.items + 1 }, () => null))}}`,
        ],
        [
            "an oversized record",
            `{"__proto__":${JSON.stringify(Object.fromEntries(Array.from({ length: GATEWAY_ARGUMENT_LIMITS.properties + 1 }, (_, index) => [String(index), null])))}}`,
        ],
        [
            "a record whose forbidden member exceeds its property budget",
            `{"__proto__":null,${JSON.stringify(Object.fromEntries(Array.from({ length: GATEWAY_ARGUMENT_LIMITS.properties }, (_, index) => [String(index), null]))).slice(1)}`,
        ],
    ])("rejects raw own __proto__ keys carrying %s without changing the input", (_label, json) => {
        for (const text of [json, `{"nested":${json}}`, `{"nested":[${json}]}`]) {
            const read = parseJsonText(text)
            assert(read.ok, "the prototype-key fixture is not valid JSON")
            const args = read.value
            const before = JSON.stringify(args)

            expect(gatewayArgumentsSchema.safeParse(args).success).toBe(false)
            expect(gatewayCallSchema.safeParse({ name: TOOL_NAME, arguments: args }).success).toBe(false)
            expect(JSON.stringify(args)).toBe(before)
        }
    })

    it("announces the forbidden record key and the object property budget in JSON Schema", () => {
        const args = resolvedSchema(GATEWAY_CALL_INPUT_SCHEMA.properties?.arguments)
        expect(args.maxProperties).toBe(GATEWAY_ARGUMENT_LIMITS.properties)
        expect(resolvedSchema(args.propertyNames)).toMatchObject({
            maxLength: GATEWAY_ARGUMENT_LIMITS.key,
            pattern: "^(?!__proto__$)",
        })
    })
})

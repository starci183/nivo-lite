import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { parseJsonText } from "@modules/platform/primitives"
import { GATEWAY_ARGUMENT_LIMITS, isAdmissibleArgumentTree } from "./gateway-arguments.policy"

/** The members of the subject under test. */
interface Subject {
    readonly isAdmissibleArgumentTree: typeof isAdmissibleArgumentTree
}

const SUBJECT = Symbol("gateway-arguments.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isAdmissibleArgumentTree } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** A value with exactly the requested number of containers around one leaf. */
const nestedAt = (depth: number, kind: "array" | "object"): unknown => {
    let value: unknown = "leaf"
    for (let level = 0; level < depth; level += 1) value = kind === "array" ? [value] : { child: value }
    return value
}

/** The value a JSON text holds, so an own `__proto__` member survives as data. */
const jsonOf = (text: string): unknown => {
    const read = parseJsonText(text)
    assert(read.ok, "the prototype-key fixture is not valid JSON")
    return read.value
}

describe("gateway-arguments.policy", () => {
    it("declares the connector argument budgets", () => {
        expect(GATEWAY_ARGUMENT_LIMITS).toEqual({
            string: 8192,
            key: 100,
            items: 100,
            properties: 100,
            depth: 8,
            json: 65_536,
        })
    })

    it.each([
        ["a scalar", "text"],
        ["null", null],
        ["an empty object", {}],
        ["flat members", { text: "value", count: 2, yes: true, empty: null, list: ["a", 1] }],
        ["objects at the depth budget", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth, "object") }],
        ["arrays at the depth budget", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth, "array") }],
    ])("admits %s", async (_label, input) => {
        const subject = await build()

        expect(subject.isAdmissibleArgumentTree(input)).toBe(true)
    })

    it.each([
        ["objects past the depth budget", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth + 1, "object") }],
        ["arrays past the depth budget", { value: nestedAt(GATEWAY_ARGUMENT_LIMITS.depth + 1, "array") }],
        ["a root own __proto__", jsonOf('{"__proto__":7}')],
        ["a nested own __proto__", jsonOf('{"nested":{"list":[{"__proto__":null}]}}')],
    ])("refuses %s", async (_label, input) => {
        const subject = await build()

        expect(subject.isAdmissibleArgumentTree(input)).toBe(false)
    })

    it("stops at the depth budget on a cyclic tree instead of walking it forever", async () => {
        const subject = await build()
        const cyclic: Record<string, unknown> = {}
        cyclic.self = cyclic

        expect(subject.isAdmissibleArgumentTree(cyclic)).toBe(false)
    })
})

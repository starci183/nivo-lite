import { Test } from "@nestjs/testing"
import { projectedOf, resolvedSchemaOf, violationOf } from "./openapi-schema.policy"

const SUBJECT = Symbol("openapi-schema.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { projectedOf, resolvedSchemaOf, violationOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-schema.policy")>(SUBJECT)
}

const SCHEMAS = {
    Customer: {
        type: "object",
        required: ["code"],
        description: "A customer",
        properties: { code: { type: "string", maxLength: 5 }, tags: { type: "array", maxItems: 2, items: { type: "string" } } },
    },
    Page: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Customer" } } } },
    Loop: { type: "object", properties: { next: { $ref: "#/components/schemas/Loop" } } },
}

describe("resolvedSchemaOf", () => {
    it("replaces a local reference by what it names and keeps only what the validator enforces", async () => {
        const subject = await build()
        const resolved = subject.resolvedSchemaOf({ $ref: "#/components/schemas/Page" }, SCHEMAS)

        expect(resolved.unsupported).toEqual([])
        expect(resolved.node).toEqual({
            type: "object",
            properties: {
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["code"],
                        properties: { code: { type: "string", maxLength: 5 }, tags: { type: "array", maxItems: 2, items: { type: "string" } } },
                    },
                },
            },
        })
    })

    it("names a refused keyword, a reference outside the document, one that names nothing and one that names itself", async () => {
        const subject = await build()
        expect(subject.resolvedSchemaOf({ type: "string", pattern: "^a+$" }, SCHEMAS).unsupported).toEqual(["pattern"])
        expect(subject.resolvedSchemaOf({ anyOf: [{ type: "string" }], not: {} }, SCHEMAS).unsupported).toEqual(["anyOf", "not"])
        expect(subject.resolvedSchemaOf({ $ref: "https://example.test/schema.json" }, SCHEMAS).unsupported).toEqual(["external $ref"])
        expect(subject.resolvedSchemaOf({ $ref: "#/components/schemas/Missing" }, SCHEMAS).unsupported).toEqual(["unresolved $ref"])
        expect(subject.resolvedSchemaOf({ $ref: "#/components/schemas/Loop" }, SCHEMAS).unsupported).toEqual(["cyclic $ref"])
    })
})

describe("violationOf", () => {
    it("answers null for a value that fits and the first place for one that does not, never the value", async () => {
        const subject = await build()
        const customer = subject.resolvedSchemaOf({ $ref: "#/components/schemas/Customer" }, SCHEMAS).node
        expect(subject.violationOf(customer, { code: "A1", tags: ["x"] })).toBeNull()
        expect(subject.violationOf(customer, {})).toBe("code: required")
        expect(subject.violationOf(customer, { code: 7 })).toBe("code: type")
        expect(subject.violationOf(customer, { code: "TOO-LONG-SECRET" })).toBe("code: maxLength")
        expect(subject.violationOf(customer, { code: "A1", tags: ["a", "b", "c"] })).toBe("tags: maxItems")
        expect(subject.violationOf(customer, { code: "A1", tags: ["a", 2] })).toBe("tags[1]: type")
        expect(subject.violationOf(customer, "text")).toBe(": type")
    })

    it("judges numbers, enums, null, strict objects and every part of allOf", async () => {
        const subject = await build()
        expect(subject.violationOf({ type: "integer", minimum: 1, maximum: 50 }, 0)).toBe(": minimum")
        expect(subject.violationOf({ type: "integer" }, 1.5)).toBe(": type")
        expect(subject.violationOf({ type: "number", exclusiveMinimum: 0 }, 0)).toBe(": exclusiveMinimum")
        expect(subject.violationOf({ type: "number", minimum: 0, exclusiveMinimum: true }, 0)).toBe(": minimum")
        expect(subject.violationOf({ type: "string", enum: ["a", "b"] }, "c")).toBe(": enum")
        expect(subject.violationOf({ type: "string", nullable: true }, null)).toBeNull()
        expect(subject.violationOf({ type: ["string", "null"] }, null)).toBeNull()
        expect(subject.violationOf({ type: "string" }, null)).toBe(": type")
        expect(subject.violationOf({ type: "object", properties: { a: { type: "string" } }, additionalProperties: false }, { a: "x", b: 1 })).toBe("b: not declared")
        expect(subject.violationOf({ allOf: [{ type: "object", required: ["a"] }, { type: "object", required: ["b"] }] }, { a: 1 })).toBe("b: required")
    })
})

describe("projectedOf", () => {
    it("drops every member the schema does not declare, at every depth, and keeps a free-form object", async () => {
        const subject = await build()
        const page = subject.resolvedSchemaOf({ $ref: "#/components/schemas/Page" }, SCHEMAS).node
        const value = { items: [{ code: "A1", note: "act on this", tags: ["x"] }], hidden: "more" }

        expect(subject.projectedOf(page, value)).toEqual({ items: [{ code: "A1", tags: ["x"] }] })
        expect(subject.projectedOf({ type: "object" }, { any: "thing" })).toEqual({ any: "thing" })
        expect(subject.projectedOf({ allOf: [{ type: "object", properties: { a: { type: "string" } } }] }, { a: "x", b: "y" })).toEqual({ a: "x" })
        expect(subject.projectedOf({ type: "object", properties: { a: {} }, additionalProperties: true }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 })
    })
})

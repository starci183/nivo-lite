import { z } from "zod"
import {
    factsOf,
    fixedParamsOf,
    isBusinessFailure,
    isParamRef,
    maskJson,
    maskSnapshot,
    maskValue,
    NodeBusinessFailure,
    paramRefsOf,
    parseRef,
    refOfText,
    refTextOf,
    resolveParams,
    SECRET_MASK,
    splitBindings,
} from "./memory"
import type { LeadMemorySnapshot, RefScope, StepMemory } from "./memory.contracts"

const done = (output: StepMemory["output"]): StepMemory => ({
    status: "done",
    output,
    error: null,
    runId: "r1",
    versionId: "v1",
    at: "2026-11-09T00:00:00.000Z",
})

const MEMORY: LeadMemorySnapshot = {
    subject: { key: "lead:l1", leadId: "l1", conversationId: null },
    lead: { address: "12 Ly Thuong Kiet", phone: "0901234567" },
    workflows: { "accounting.payment": { settle: done({ paidVnd: 500_000 }) } },
}

const SCOPE: RefScope = {
    trigger: { text: "hi", channel: "zalo" },
    steps: {
        order: done({ address: "335 Ba Trieu", lines: [{ sku: "rose" }] }),
        check: {
            ...done(null),
            status: "failed",
            error: { code: "out_of_stock", messageKey: "k", message: "gone", fields: { sku: "rose" } },
        },
    },
    namespace: "sales.consult",
    memory: MEMORY,
}

describe("refs", () => {
    it("parses the four roots and refuses anything else", () => {
        expect(parseRef("trigger.text")).toEqual({
            root: "trigger",
            namespace: null,
            nodeKey: null,
            part: null,
            path: ["text"],
        })
        expect(parseRef("steps.order.output.address")).toMatchObject({
            nodeKey: "order",
            part: "output",
            path: ["address"],
        })
        expect(parseRef("steps.check.error.code")).toMatchObject({ part: "error", path: ["code"] })
        expect(parseRef("lead.address")).toMatchObject({ root: "lead", path: ["address"] })
        expect(parseRef("workflows.accounting.payment.steps.settle.output.paidVnd")).toMatchObject({
            namespace: "accounting.payment",
            nodeKey: "settle",
            path: ["paidVnd"],
        })
        const bad = [
            "order.address",
            "steps.order",
            "steps.order.result.x",
            "lead.shoeSize",
            "lead",
            "workflows.a.steps.x.output",
            "trigger..x",
        ]
        for (const text of bad) expect(parseRef(text)).toBeNull()
    })

    it("reads the editor's `=` text and writes it back", () => {
        expect(refOfText("= lead.address")).toEqual({ $ref: "lead.address" })
        expect(refOfText("335 Ba Trieu")).toBeNull()
        expect(refOfText("=")).toBeNull()
        expect(refTextOf({ $ref: "trigger.text" })).toBe("= trigger.text")
        expect(isParamRef({ $ref: "x", default: 1 })).toBe(true)
        expect(isParamRef({ $ref: "x", other: 1 })).toBe(false)
    })

    it("resolves fixed values, refs at any depth, defaults, and leaves out a ref that finds nothing", () => {
        const params = {
            tone: "warm",
            address: { $ref: "lead.address" },
            shipTo: { $ref: "steps.order.output.address" },
            sku: { $ref: "steps.order.output.lines.0.sku" },
            reason: { $ref: "steps.check.error.code" },
            paid: { $ref: "workflows.accounting.payment.steps.settle.output.paidVnd" },
            missing: { $ref: "steps.later.output.x" },
            withDefault: { $ref: "steps.later.output.x", default: 3 },
            nested: { to: { $ref: "trigger.channel" }, list: [{ $ref: "steps.later.output.x" }] },
        }
        expect(resolveParams(params, SCOPE)).toEqual({
            tone: "warm",
            address: "12 Ly Thuong Kiet",
            shipTo: "335 Ba Trieu",
            sku: "rose",
            reason: "out_of_stock",
            paid: 500_000,
            withDefault: 3,
            nested: { to: "zalo", list: [null] },
        })
    })

    it("reads no output from a failed step and no failure from a done one", () => {
        const params = { a: { $ref: "steps.check.output.x" }, b: { $ref: "steps.order.error.code" } }
        expect(resolveParams(params, SCOPE)).toEqual({})
    })

    it("lists every ref with its field and judges params with refs as their defaults", () => {
        const params = { a: { $ref: "lead.phone" }, b: { c: { $ref: "trigger.x", default: "d" } }, e: 1 }
        expect(paramRefsOf(params).map(({ field }) => field)).toEqual(["a", "b"])
        expect(fixedParamsOf(params)).toEqual({ b: { c: "d" }, e: 1 })
    })

    it("splits one place of bindings between the params and the input schema of the node", () => {
        const node = { params: z.object({ tone: z.string().max(200) }), input: z.object({ text: z.string().max(200) }) }
        expect(splitBindings(node, { tone: "warm", text: "hi", stray: 1 }, { legacy: 2, text: "old" })).toEqual({
            params: { tone: "warm" },
            input: { legacy: 2, text: "hi" },
        })
        expect(splitBindings({ params: z.object({}), input: z.string().max(200) }, { a: 1 }).input).toEqual({ a: 1 })
    })
})

describe("business failures, facts and masking", () => {
    it("carries a typed failure", () => {
        const failure = new NodeBusinessFailure({
            code: "address_missing",
            messageKey: "k",
            message: "m",
            fields: { field: "address" },
        })
        expect(isBusinessFailure(failure)).toBe(true)
        expect(isBusinessFailure(new Error("x"))).toBe(false)
        expect(failure.failure.fields).toEqual({ field: "address" })
    })

    it("takes the facts a node's output proves, skipping empty ones", () => {
        const output = { delivery: { address: "335 Ba Trieu" }, phone: "", name: null }
        expect(factsOf({ facts: { address: "delivery.address", phone: "phone", name: "name" } }, output)).toEqual({
            address: "335 Ba Trieu",
        })
        expect(factsOf(undefined, { a: 1 })).toEqual({})
    })

    it("masks secrets and personal data for display, keeps files and plain data", () => {
        expect(maskValue("0901234567", "pii")).toBe("09••••••67")
        expect(maskValue("abc", "pii")).toBe("•••")
        expect(maskValue("x", "secret")).toBe(SECRET_MASK)
        const file = { $file: "image", id: "f1", mime: "image/png" }
        const value = { phone: "0901234567", apiToken: "t", total: 5, receipt: file, nested: { note: "n" } }
        expect(maskJson(value, { "nested.note": "pii" })).toEqual({
            phone: "09••••••67",
            apiToken: SECRET_MASK,
            total: 5,
            receipt: file,
            nested: { note: "•" },
        })
        const masked = maskSnapshot(MEMORY)
        expect(masked.lead.phone).toBe("09••••••67")
        expect(masked.workflows["accounting.payment"]?.["settle"]?.output).toEqual({ paidVnd: 500_000 })
    })
})

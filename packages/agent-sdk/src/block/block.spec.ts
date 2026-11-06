import { z } from "zod"
import { defineAction, defineBlock, defineRead } from "./block"
import { definePort } from "../port/port"
import type { PortProvider } from "../port/port.types"
import { SdkDefinitionError } from "./definition-error"

const READ = {
    dataKind: "order",
    shape: "list",
    fields: ["id"],
    paths: {},
    variables: z.object({}),
    operation: "orders",
    permission: "p",
} as const

describe("defineBlock", () => {
    it("computes the JSON Schema of the props once and keeps the config", () => {
        const block = defineBlock({
            id: "core.figures",
            title: { key: "t" },
            props: z.object({ label: z.string().max(100) }),
            slots: {},
            children: false,
        })
        expect(block.entry).toBe("block")
        expect(block.propsJson).toMatchObject({ type: "object", properties: { label: { type: "string" } } })
    })

    it("refuses a malformed id and props that do not convert to JSON Schema", () => {
        const config = { title: { key: "t" }, slots: {}, children: false } as const
        expect(() => defineBlock({ ...config, id: "Core.Figures", props: z.object({}) })).toThrow(SdkDefinitionError)
        const error = captured(() => defineBlock({ ...config, id: "core.bad", props: z.object({ at: z.date() }) }))
        expect(error).toMatchObject({ code: "BLOCK_PROPS_UNSERIALIZABLE", at: "core.bad", name: "SdkDefinitionError" })
    })
})

describe("defineRead and defineAction", () => {
    it("define a read and an action", () => {
        expect(defineRead({ ...READ, id: "sales.orders" }).entry).toBe("read")
        expect(defineAction({ id: "sales.open", operation: "o", permission: "p", label: { key: "l" } }).entry).toBe(
            "action",
        )
    })

    it("refuse a malformed id, and read variables that do not convert", () => {
        expect(captured(() => defineRead({ ...READ, id: "Orders.x" }))).toMatchObject({ code: "ID_MALFORMED" })
        expect(
            captured(() => defineRead({ ...READ, id: "sales.orders", variables: z.object({ at: z.date() }) })),
        ).toMatchObject({ code: "READ_VARIABLES_UNSERIALIZABLE" })
        expect(
            captured(() => defineAction({ id: "Open.x", operation: "o", permission: "p", label: { key: "l" } })),
        ).toMatchObject({
            code: "ID_MALFORMED",
        })
    })
})

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

interface Counter {
    readonly next: () => number
}
const COUNTER = definePort<Counter>("billing.counter")
const CONTEXT = {
    workspaceId: "w1",
    memberId: null,
    now: new Date("2026-11-05T00:00:00Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
} as const
const PROVIDER: PortProvider = { implementationOf: () => ({ next: () => 7 }) }

describe("defineRead that runs", () => {
    const read = defineRead({
        id: "billing.invoice",
        dataKind: "invoice",
        shape: "record",
        fields: ["number"],
        paths: {},
        variables: z.object({ prefix: z.string().max(10) }),
        permission: "billing.view",
        ports: { counter: COUNTER },
        run: ({ counter }, variables) => Promise.resolve({ number: `${variables.prefix}-${counter.next()}` }),
    })

    it("is a read whose operation is its id, with its ports and a runner", () => {
        expect(read).toMatchObject({ entry: "read", id: "billing.invoice", operation: "billing.invoice" })
        expect(read.ports).toEqual({ counter: COUNTER })
        expect(read).not.toHaveProperty("run")
    })

    it("executes: parses the variables, builds the ports and returns the data of run", async () => {
        await expect(read.execute?.(PROVIDER, { prefix: "INV" }, CONTEXT)).resolves.toEqual({
            ok: true,
            data: { number: "INV-7" },
        })
    })

    it("refuses variables the read does not declare or that do not parse, without running", async () => {
        await expect(read.execute?.(PROVIDER, { prefix: "INV", extra: 1 }, CONTEXT)).resolves.toEqual({
            ok: false,
            problems: [{ code: "INPUT_UNKNOWN_KEY", at: "extra" }],
        })
        await expect(read.execute?.(PROVIDER, { prefix: 3 }, CONTEXT)).resolves.toEqual({
            ok: false,
            problems: [{ code: "INPUT_INVALID", at: "prefix" }],
        })
    })

    it("refuses a malformed id and variables that do not convert, like a host-operation read", () => {
        const config = { ...READ, ports: {}, run: () => Promise.resolve(null) }
        expect(captured(() => defineRead({ ...config, id: "Bad.id" }))).toMatchObject({ code: "ID_MALFORMED" })
        expect(
            captured(() => defineRead({ ...config, id: "billing.bad", variables: z.object({ at: z.date() }) })),
        ).toMatchObject({ code: "READ_VARIABLES_UNSERIALIZABLE" })
    })
})

describe("defineAction that runs", () => {
    const action = defineAction({
        id: "billing.issue",
        permission: "billing.manage",
        label: { key: "issue" },
        input: z.object({ id: z.string().max(10), amount: z.number() }),
        ports: { counter: COUNTER },
        run: ({ counter }, input) =>
            Promise.resolve(
                input.amount > 0
                    ? { ok: true, data: { number: counter.next(), id: input.id } }
                    : { ok: false, reason: "refused", message: { key: "no_amount" }, data: { min: 1 } },
            ),
        refreshes: ["billing.invoice"],
    })

    it("is an action whose operation is its id, with the defaults of the optional members", () => {
        expect(action).toMatchObject({
            entry: "action",
            id: "billing.issue",
            operation: "billing.issue",
            transactional: false,
            optimistic: false,
            refreshes: ["billing.invoice"],
        })
        expect(action.input).toBeDefined()
        expect(action).not.toHaveProperty("run")
    })

    it("keeps transactional and optimistic when given", () => {
        const flagged = defineAction({
            id: "billing.flagged",
            permission: "p",
            label: { key: "l" },
            input: z.object({}),
            ports: {},
            run: () => Promise.resolve({ ok: true }),
            refreshes: [],
            transactional: true,
            optimistic: true,
        })
        expect(flagged).toMatchObject({ transactional: true, optimistic: true })
    })

    it("executes: parses the payload, builds the ports and returns the result of run, refusals included", async () => {
        await expect(action.execute?.(PROVIDER, { id: "a", amount: 5 }, CONTEXT)).resolves.toEqual({
            ok: true,
            data: { number: 7, id: "a" },
        })
        await expect(action.execute?.(PROVIDER, { id: "a", amount: 0 }, CONTEXT)).resolves.toEqual({
            ok: false,
            reason: "refused",
            message: { key: "no_amount" },
            data: { min: 1 },
        })
    })

    it("answers invalid, naming each broken field and the unknown keys, without running", async () => {
        const result = await action.execute?.(PROVIDER, { id: "a", amount: "x", force: true }, CONTEXT)
        expect(result).toMatchObject({ ok: false, reason: "invalid" })
        expect(result && !result.ok && result.reason === "invalid" ? Object.keys(result.fields ?? {}) : []).toEqual([
            "force",
            "amount",
        ])
    })
})

import { z } from "zod"
import { defineAction, defineBlock, defineRead } from "./block"
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

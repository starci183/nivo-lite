import { Test } from "@nestjs/testing"
import { insertStampOf, leadEntityOf } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { mock } from "@starci/jest-preset"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { dataOf, defaultsOf, scalarOf, sequenceFieldsOf } from "./record-data.policy"

const RECORD_DATA: unique symbol = Symbol("entity-engine.record-data")

interface RecordDataPolicy {
    readonly dataOf: typeof dataOf
    readonly defaultsOf: typeof defaultsOf
    readonly scalarOf: typeof scalarOf
    readonly sequenceFieldsOf: typeof sequenceFieldsOf
}

const build = async (): Promise<RecordDataPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: RECORD_DATA,
                useFactory: (): RecordDataPolicy => ({ dataOf, defaultsOf, scalarOf, sequenceFieldsOf }),
            },
        ],
    }).compile()
    return moduleRef.get<RecordDataPolicy>(RECORD_DATA)
}

const shapeOf = (): ReturnType<typeof mock<MetaShape>> => {
    const shape = mock<MetaShape>()
    shape.parse.mockImplementation((value) => ({ parsed: value }))
    return shape
}

describe("dataOf", () => {
    it("stores the values of declared fields as given", async () => {
        const policy = await build()

        expect(policy.dataOf(leadEntityOf(shapeOf()), { contactName: "An", phone: null, amount: 5 })).toEqual({
            contactName: "An",
            phone: null,
            amount: 5,
        })
    })

    it("parses a jsonb value through the shape its field declares and keeps null", async () => {
        const policy = await build()
        const shape = shapeOf()

        expect(policy.dataOf(leadEntityOf(shape), { meta: { a: 1 } })).toEqual({ meta: { parsed: { a: 1 } } })
        expect(shape.parse).toHaveBeenCalledWith({ a: 1 })
        expect(policy.dataOf(leadEntityOf(shape), { bare: null })).toEqual({ bare: null })
    })

    it("refuses a jsonb value for a field without a declared shape", async () => {
        const policy = await build()

        expect(() => policy.dataOf(leadEntityOf(shapeOf()), { bare: { a: 1 } })).toThrow(
            EntityEngineErrorCode.ValueInvalid,
        )
    })

    it("refuses a sequence field", async () => {
        const policy = await build()

        expect(() => policy.dataOf(leadEntityOf(shapeOf()), { code: "DH-1" })).toThrow(
            EntityEngineErrorCode.ValueInvalid,
        )
    })

    it.each(["ghost", "workspaceId", "constructor"])(
        "refuses the key %s that is not a declared field",
        async (name) => {
            const policy = await build()

            expect(() => policy.dataOf(leadEntityOf(shapeOf()), { [name]: "x" })).toThrow(
                EntityEngineErrorCode.FieldUnknown,
            )
        },
    )
})

describe("defaultsOf", () => {
    it("writes the declared defaults and leaves sequence fields and fields without a default out", async () => {
        const policy = await build()

        expect(policy.defaultsOf(leadEntityOf(shapeOf()), insertStampOf())).toEqual({
            stage: "new",
            seenAt: "2026-11-05T10:00:00.000Z",
            token: "00000000-0000-4000-8000-000000000001",
            note: "",
            meta: {},
        })
    })
})

describe("sequenceFieldsOf", () => {
    it("lists the sequence fields with their declarations", async () => {
        const policy = await build()

        expect(policy.sequenceFieldsOf(leadEntityOf(shapeOf())).map(([name]) => name)).toEqual(["code", "ticket"])
    })
})

describe("scalarOf", () => {
    it.each([
        ["a", "a"],
        [3, 3],
        [false, false],
        [null, null],
        [undefined, null],
    ])("reads %p as the scalar %p", async (value, expected) => {
        const policy = await build()

        expect(policy.scalarOf(leadEntityOf(shapeOf()), "phone", value)).toBe(expected)
    })

    it("refuses an object as a key value", async () => {
        const policy = await build()

        expect(() => policy.scalarOf(leadEntityOf(shapeOf()), "phone", { a: 1 })).toThrow(
            EntityEngineErrorCode.ValueInvalid,
        )
    })
})

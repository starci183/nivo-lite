import { Test } from "@nestjs/testing"
import { insertStampOf, leadEntityOf } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { mock } from "@starci/jest-preset"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
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

})

describe("dataOf of file fields", () => {
    it("stores a file reference the field accepts and refuses one off its types or size", async () => {
        const policy = await build()
        const project = defineEntity({
            name: "fixture.project",
            dataKind: "fixture-project",
            fields: { cover: field.file({ accept: ["image/*"], maxBytes: 100 }) },
        })
        const cover = { key: "w/fixture.project/r/cover/o", mime: "image/png", size: 100, name: "a.png" }

        expect(policy.dataOf(project, { cover })).toEqual({ cover })
        expect(policy.dataOf(project, { cover: null })).toEqual({ cover: null })
        expect(() => policy.dataOf(project, { cover: { ...cover, mime: "video/mp4" } })).toThrow(
            EntityEngineErrorCode.ValueInvalid,
        )
        expect(() => policy.dataOf(project, { cover: { ...cover, size: 101 } })).toThrow(EntityEngineErrorCode.ValueInvalid)
    })

    it("stores a list of file references in order, refuses one past its max, a repeated object or one off its types, and takes the empty list", async () => {
        const policy = await build()
        const set = defineEntity({
            name: "fixture.photo-set",
            dataKind: "fixture-photo-set",
            fields: { photos: field.file({ accept: ["image/*"], maxBytes: 100, many: true, max: 2 }) },
        })
        const item = (n: number, mime = "image/png") => ({ key: `w/fixture.photo-set/r/photos/o${n}`, mime, size: 10, name: `p${n}.png` })

        expect(policy.dataOf(set, { photos: [item(2), item(1)] })).toEqual({ photos: [item(2), item(1)] })
        expect(policy.dataOf(set, { photos: [] })).toEqual({ photos: [] })
        expect(() => policy.dataOf(set, { photos: [item(1), item(2), item(3)] })).toThrow(EntityEngineErrorCode.ValueInvalid)
        expect(() => policy.dataOf(set, { photos: [item(1), item(1)] })).toThrow(EntityEngineErrorCode.ValueInvalid)
        expect(() => policy.dataOf(set, { photos: [item(1, "video/mp4")] })).toThrow(EntityEngineErrorCode.ValueInvalid)
        expect(() => policy.dataOf(set, { photos: item(1) })).toThrow(EntityEngineErrorCode.ValueInvalid)
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

describe("defaultsOf: a list file field", () => {
    it("starts empty: an empty list, never a text", async () => {
        const policy = await build()
        const set = defineEntity({
            name: "fixture.photo-set",
            dataKind: "fixture-photo-set",
            fields: { photos: field.file({ accept: ["image/*"], maxBytes: 100, many: true, max: 2 }) },
        })

        expect(policy.defaultsOf(set, insertStampOf())).toEqual({ photos: [] })
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

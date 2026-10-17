import { Test } from "@nestjs/testing"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { OPENAPI_TEXT } from "./messages/openapi.messages"
import {
    apiScalarText,
    detectItems,
    getPath,
    isApiJsonObject,
    itemsOf,
    parseJsonBody,
    readApiJson,
    suggestFields,
    suggestFromItems,
} from "./openapi-items.policy"

const SUBJECT = Symbol("openapi-items.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isApiJsonObject,
                    readApiJson,
                    suggestFields,
                    getPath,
                    detectItems,
                    itemsOf,
                    suggestFromItems,
                    apiScalarText,
                    parseJsonBody,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./openapi-items.policy")>(SUBJECT)
}

describe("openapi items", () => {
    describe("readApiJson and isApiJsonObject", () => {
        it("reads JSON and tells an object from an array or a scalar", async () => {
            const subject = await buildSubject()
            expect(subject.readApiJson('{"id":1}')).toEqual({ value: { id: 1 } })
            expect(subject.readApiJson("no").cause).toBeInstanceOf(SyntaxError)
            expect(subject.isApiJsonObject({ id: 1 })).toBe(true)
            expect(subject.isApiJsonObject([1])).toBe(false)
            expect(subject.isApiJsonObject(null)).toBe(false)
        })
    })
    describe("suggestFields", () => {
        it("picks a known id and title, then a name ending in id, then the first key", async () => {
            const subject = await buildSubject()
            expect(subject.suggestFields(["name", "id"])).toEqual({ idField: "id", titleField: "name" })
            expect(subject.suggestFields(["orderId", "zzz"])).toEqual({ idField: "orderId", titleField: "zzz" })
            expect(subject.suggestFields(["zzz"])).toEqual({ idField: "zzz", titleField: "" })
            expect(subject.suggestFields(["sku"])).toEqual({ idField: "sku", titleField: "" })
            expect(subject.suggestFields([])).toEqual({ idField: "", titleField: "" })
        })
    })
    describe("getPath, detectItems and itemsOf", () => {
        const body = { data: { items: [{ id: "1" }], note: "x" }, list: [2] }
        it("walks objects and arrays and stops when the path leaves an object", async () => {
            const subject = await buildSubject()
            expect(subject.getPath(body, "  ")).toBe(body)
            expect(subject.getPath(body, "data.items.0.id")).toBe("1")
            expect(subject.getPath(body, "data.note.extra")).toBeUndefined()
            expect(subject.getPath(body, "missing")).toBeUndefined()
        })
        it("finds the first array, including one two levels down, and not one deeper", async () => {
            const subject = await buildSubject()
            expect(subject.detectItems([{ id: "1" }])).toEqual({ found: true, path: "", items: [{ id: "1" }] })
            expect(subject.detectItems(body)).toEqual({ found: true, path: "list", items: [2] })
            expect(subject.detectItems({ data: { items: [{ id: "1" }] } })).toEqual({
                found: true,
                path: "data.items",
                items: [{ id: "1" }],
            })
            expect(subject.detectItems({ a: { b: { c: [1] } } })).toEqual({ found: true, path: "a.b.c", items: [1] })
            expect(subject.detectItems({ a: { b: { c: { d: [1] } } } })).toEqual({ found: false, path: "", items: [] })
            expect(subject.detectItems(4)).toEqual({ found: false, path: "", items: [] })
        })
        it("uses the owner's path, then the first array, then the object itself", async () => {
            const subject = await buildSubject()

            expect(subject.itemsOf(body, "data.items")).toEqual([{ id: "1" }])
            expect(subject.itemsOf(body, "data.note")).toEqual([2])
            expect(subject.itemsOf({ id: "1" }, "")).toEqual([{ id: "1" }])
            expect(subject.itemsOf("no", "")).toEqual([])
        })
    })
})

describe("openapi item values", () => {
    describe("suggestFromItems, apiScalarText and parseJsonBody", () => {
        it("guesses fields from the first object and reads only scalars", async () => {
            const subject = await buildSubject()

            expect(subject.suggestFromItems(["no", { id: "1", name: "Ada" }])).toEqual({
                idField: "id",
                titleField: "name",
            })
            expect(subject.suggestFromItems(["no"])).toEqual({ idField: "", titleField: "" })
            expect(subject.apiScalarText("Ada")).toBe("Ada")
            expect(subject.apiScalarText(2)).toBe("2")
            expect(subject.apiScalarText(false)).toBe("false")
            expect(subject.apiScalarText({ id: 1 })).toBe("")
        })

        it("returns the JSON value or refuses a body that is not JSON", async () => {
            const subject = await buildSubject()

            expect(subject.parseJsonBody("1")).toBe(1)
            expect(() => subject.parseJsonBody("no")).toThrow(
                expect.objectContaining({
                    code: DataSourcesErrorCode.Rejected,
                    params: { detail: OPENAPI_TEXT.notJson },
                }),
            )
        })
    })
})

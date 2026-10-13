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

describe("openapi items", () => {
    describe("readApiJson and isApiJsonObject", () => {
        it("reads JSON and tells an object from an array or a scalar", () => {
            expect(readApiJson('{"id":1}')).toEqual({ value: { id: 1 } })
            expect(readApiJson("no").cause).toBeInstanceOf(SyntaxError)
            expect(isApiJsonObject({ id: 1 })).toBe(true)
            expect(isApiJsonObject([1])).toBe(false)
            expect(isApiJsonObject(null)).toBe(false)
        })
    })

    describe("suggestFields", () => {
        it("picks a known id and title, then a name ending in id, then the first key", () => {
            expect(suggestFields(["name", "id"])).toEqual({ idField: "id", titleField: "name" })
            expect(suggestFields(["orderId", "zzz"])).toEqual({ idField: "orderId", titleField: "zzz" })
            expect(suggestFields(["zzz"])).toEqual({ idField: "zzz", titleField: "" })
            expect(suggestFields(["sku"])).toEqual({ idField: "sku", titleField: "" })
            expect(suggestFields([])).toEqual({ idField: "", titleField: "" })
        })
    })

    describe("getPath, detectItems and itemsOf", () => {
        const body = { data: { items: [{ id: "1" }], note: "x" }, list: [2] }

        it("walks objects and arrays and stops when the path leaves an object", () => {
            expect(getPath(body, "  ")).toBe(body)
            expect(getPath(body, "data.items.0.id")).toBe("1")
            expect(getPath(body, "data.note.extra")).toBeUndefined()
            expect(getPath(body, "missing")).toBeUndefined()
        })

        it("finds the first array, including one two levels down, and not one deeper", () => {
            expect(detectItems([{ id: "1" }])).toEqual({ found: true, path: "", items: [{ id: "1" }] })
            expect(detectItems(body)).toEqual({ found: true, path: "list", items: [2] })
            expect(detectItems({ data: { items: [{ id: "1" }] } })).toEqual({
                found: true,
                path: "data.items",
                items: [{ id: "1" }],
            })
            expect(detectItems({ a: { b: { c: [1] } } })).toEqual({ found: true, path: "a.b.c", items: [1] })
            expect(detectItems({ a: { b: { c: { d: [1] } } } })).toEqual({ found: false, path: "", items: [] })
            expect(detectItems(4)).toEqual({ found: false, path: "", items: [] })
        })

        it("uses the owner's path, then the first array, then the object itself", () => {
            expect(itemsOf(body, "data.items")).toEqual([{ id: "1" }])
            expect(itemsOf(body, "data.note")).toEqual([2])
            expect(itemsOf({ id: "1" }, "")).toEqual([{ id: "1" }])
            expect(itemsOf("no", "")).toEqual([])
        })
    })

    describe("suggestFromItems, apiScalarText and parseJsonBody", () => {
        it("guesses fields from the first object and reads only scalars", () => {
            expect(suggestFromItems(["no", { id: "1", name: "Ada" }])).toEqual({ idField: "id", titleField: "name" })
            expect(suggestFromItems(["no"])).toEqual({ idField: "", titleField: "" })
            expect(apiScalarText("Ada")).toBe("Ada")
            expect(apiScalarText(2)).toBe("2")
            expect(apiScalarText(false)).toBe("false")
            expect(apiScalarText({ id: 1 })).toBe("")
        })

        it("returns the JSON value or refuses a body that is not JSON", () => {
            expect(parseJsonBody("1")).toBe(1)
            expect(() => parseJsonBody("no")).toThrow(
                expect.objectContaining({
                    code: DataSourcesErrorCode.Rejected,
                    params: { detail: OPENAPI_TEXT.notJson },
                }),
            )
        })
    })
})

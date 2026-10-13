import { DATE_OID, appPgTypes } from "./pg-types.policy"

describe("appPgTypes", () => {
    it("keeps a date as its calendar-day text", () => {
        expect(Reflect.apply(appPgTypes().getTypeParser(DATE_OID), undefined, ["2026-10-14"])).toBe("2026-10-14")
    })

    it("keeps the driver parser of every other type", () => {
        expect(Reflect.apply(appPgTypes().getTypeParser(23), undefined, ["42"])).toBe(42)
    })
})

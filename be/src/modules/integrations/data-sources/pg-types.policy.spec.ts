import { Test } from "@nestjs/testing"
import { DATE_OID, appPgTypes } from "./pg-types.policy"

const SUBJECT = Symbol("pg-types.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { appPgTypes } }],
    }).compile()
    return moduleRef.get<Pick<typeof import("./pg-types.policy"), "appPgTypes">>(SUBJECT)
}

describe("appPgTypes", () => {
    it("keeps a date as its calendar-day text", async () => {
        const subject = await buildSubject()

        expect(Reflect.apply(subject.appPgTypes().getTypeParser(DATE_OID), undefined, ["2026-10-14"])).toBe(
            "2026-10-14",
        )
    })

    it("keeps the driver parser of every other type", async () => {
        const subject = await buildSubject()

        expect(Reflect.apply(subject.appPgTypes().getTypeParser(23), undefined, ["42"])).toBe(42)
    })

    it("passes a cell through as text when the driver has no callable parser for the type", async () => {
        const subject = await buildSubject()
        const driver = jest.requireActual<typeof import("pg-types")>("pg-types")
        const lookup = jest.spyOn(driver, "getTypeParser").mockReturnValueOnce(null as never)

        expect(Reflect.apply(subject.appPgTypes().getTypeParser(23), undefined, ["42"])).toBe("42")
        expect(lookup).toHaveBeenCalledWith(23, undefined)
        lookup.mockRestore()
    })
})

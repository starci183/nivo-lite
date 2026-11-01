import { Test } from "@nestjs/testing"
import { placeOfRow } from "./passage-place.policy"

const SUBJECT = Symbol("passage-place.policy")
type Subject = { placeOfRow: typeof placeOfRow }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { placeOfRow } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("placeOfRow", () => {
    it.each([
        ["page", "3"],
        ["slide", "2"],
        ["sheet", "Gia"],
    ])("names the place of a %s", async (kind, label) => {
        const subject = await build()

        expect(subject.placeOfRow(kind, label)).toEqual({ kind, label })
    })

    it.each([
        [null, null],
        ["page", null],
        [null, "3"],
        ["chapter", "3"],
    ])("names no place for a row stored before places or with a kind nobody knows (%s, %s)", async (kind, label) => {
        const subject = await build()

        expect(subject.placeOfRow(kind, label)).toBeNull()
    })
})

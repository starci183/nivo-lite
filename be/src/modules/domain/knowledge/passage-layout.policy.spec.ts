import { Test } from "@nestjs/testing"
import type { PassagePlace } from "@modules/domain/knowledge-chunks"
import { layoutOf } from "./passage-layout.policy"

const SUBJECT = Symbol("passage-layout.policy")
type Subject = { layoutOf: typeof layoutOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { layoutOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const FIRST: PassagePlace = { kind: "page", label: "1" }
const SECOND: PassagePlace = { kind: "page", label: "2" }

describe("layoutOf", () => {
    it("cuts a file that names its pages page by page and gives the place of every passage by order", async () => {
        const subject = await build()

        expect(
            subject.layoutOf("First page words\nSecond page words", [
                { place: FIRST, text: "First page words" },
                { place: SECOND, text: "Second page words" },
            ]),
        ).toEqual({
            located: [
                { place: FIRST, text: "First page words" },
                { place: SECOND, text: "Second page words" },
            ],
            places: [
                { order: 0, place: FIRST },
                { order: 1, place: SECOND },
            ],
        })
    })

    it("cuts a text that names no place as one stretch and leaves the stored places alone", async () => {
        const subject = await build()

        expect(subject.layoutOf("Open 8 to 21", undefined)).toEqual({
            located: [{ place: null, text: "Open 8 to 21" }],
            places: [],
        })
    })
})

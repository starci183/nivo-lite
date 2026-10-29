import { Test } from "@nestjs/testing"
import { postedCardOf as realPostedCardOf, postedMessageOf as realPostedMessageOf } from "./posted-rows.policy"

const SUBJECT = Symbol("posted-rows.policy")
type Subject = { postedCardOf: typeof realPostedCardOf; postedMessageOf: typeof realPostedMessageOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { postedCardOf: realPostedCardOf, postedMessageOf: realPostedMessageOf } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const LINE = {
    id: "m-1",
    author_kind: "human",
    author_name: "Minh",
    author_user_id: null,
    agent_id: null,
    staff_id: null,
    body: "Hello",
    lead_id: null,
    work_item_id: null,
    room: null,
    created_at: "2026-10-30T01:00:00+00:00",
}

describe("postedCardOf", () => {
    it("answers the first row that names an id and a room", async () => {
        const { postedCardOf } = await buildSubject()

        expect(postedCardOf([{ nothing: true }, { id: "m-1", room: "sales" }])).toEqual({ id: "m-1", room: "sales" })
        expect(postedCardOf([{ id: "m-2", room: null }])).toEqual({ id: "m-2", room: null })
    })

    it("answers undefined when the answer is no list or holds no such row", async () => {
        const { postedCardOf } = await buildSubject()

        expect(postedCardOf(undefined)).toBeUndefined()
        expect(postedCardOf([])).toBeUndefined()
        expect(postedCardOf(["text", null])).toBeUndefined()
    })
})

describe("postedMessageOf", () => {
    it("answers the first complete stored line", async () => {
        const { postedMessageOf } = await buildSubject()

        expect(postedMessageOf([{ id: "m-0" }, LINE])).toEqual(LINE)
    })

    it("answers undefined when the answer is no list or holds no complete line", async () => {
        const { postedMessageOf } = await buildSubject()

        expect(postedMessageOf({ id: "m-1" })).toBeUndefined()
        expect(postedMessageOf([{ ...LINE, room: 5 }])).toBeUndefined()
    })
})

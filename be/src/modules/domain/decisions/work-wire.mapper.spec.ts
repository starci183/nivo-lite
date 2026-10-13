import { commandPayloadOf, fieldRecordOf, workEditsOf } from "./work-wire.mapper"

describe("work wire mapper", () => {
    it("turns named fields into a record and leaves an absent list absent", () => {
        expect(fieldRecordOf(undefined)).toBeUndefined()
        expect(fieldRecordOf([{ name: "qty", number: 3 }, { name: "note", text: "hi" }, { name: "empty" }])).toEqual({
            qty: 3,
            note: "hi",
            empty: null,
        })
    })

    it("builds the edits the engine merges and drops what the request left out", () => {
        expect(workEditsOf(undefined)).toEqual({})
        expect(workEditsOf({})).toEqual({})
        expect(
            workEditsOf({ draft: "New", amount_vnd: null, fields: [{ name: "qty", number: 2 }], candidateId: "c-1" }),
        ).toEqual({ draft: "New", amount_vnd: null, fields: { qty: 2 }, candidateId: "c-1" })
    })

    it("puts the ids over a field of the same name in a command payload", () => {
        expect(commandPayloadOf({})).toEqual({})
        expect(
            commandPayloadOf({
                subjectType: "order",
                subjectId: "o-1",
                leadId: "l-1",
                fields: [
                    { name: "lead_id", text: "evil" },
                    { name: "items", text: "tea" },
                ],
            }),
        ).toEqual({ subject_type: "order", subject_id: "o-1", lead_id: "l-1", items: "tea" })
    })
})

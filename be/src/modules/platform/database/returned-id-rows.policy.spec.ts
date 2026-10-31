import { Test } from "@nestjs/testing"
import { returnedIdRows } from "./returned-id-rows.policy"

const RETURNED_ID_ROWS_POLICY: unique symbol = Symbol("database.returned-id-rows")

/** The policy under test, resolved through a testing module as the unit spec standard asks. */
interface ReturnedIdRowsPolicy {
    readonly returnedIdRows: typeof returnedIdRows
}

describe("returned id rows", () => {
    let subject: ReturnedIdRowsPolicy

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                { provide: RETURNED_ID_ROWS_POLICY, useFactory: (): ReturnedIdRowsPolicy => ({ returnedIdRows }) },
            ],
        }).compile()
        subject = moduleRef.get<ReturnedIdRowsPolicy>(RETURNED_ID_ROWS_POLICY)
    })

    it("keeps the rows that carry a text id", () => {
        expect(subject.returnedIdRows([{ id: "a", extra: 1 }, { id: "b" }])).toEqual([{ id: "a" }, { id: "b" }])
    })

    it.each([[undefined], [null], [{ id: "a" }], [[null]], [[{ id: 7 }]]])("answers none for %j", (raw) => {
        expect(subject.returnedIdRows(raw)).toEqual([])
    })
})

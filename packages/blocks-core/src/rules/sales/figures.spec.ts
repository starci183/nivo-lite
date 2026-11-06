import { salesFiguresOf } from "./figures"

describe("salesFiguresOf", () => {
    it("counts the open customers, carries what the orders add up to and gives the won share", () => {
        expect(
            salesFiguresOf(
                { new: 2, qualified: 1, proposal: 1, won: 3, lost: 1 },
                { draftCount: 2, draftVnd: 10, closedCount: 2, closedVnd: 12 },
            ),
        ).toEqual({
            openCount: 4,
            proposalCount: 2,
            proposalValueVnd: 10,
            closedCount: 2,
            closedValueVnd: 12,
            conversion: 0.75,
        })
    })

    it("is all zero for nothing, with no division by zero", () => {
        expect(salesFiguresOf({}, { draftCount: 0, draftVnd: 0, closedCount: 0, closedVnd: 0 })).toEqual({
            openCount: 0,
            proposalCount: 0,
            proposalValueVnd: 0,
            closedCount: 0,
            closedValueVnd: 0,
            conversion: 0,
        })
    })
})

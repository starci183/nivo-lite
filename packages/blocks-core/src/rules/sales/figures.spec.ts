import { salesFiguresOf } from "./figures"

describe("salesFiguresOf", () => {
    it("counts the open customers, adds the draft and the confirmed orders and gives the won share", () => {
        expect(
            salesFiguresOf({ new: 2, qualified: 1, proposal: 1, won: 3, lost: 1 }, [
                { status: "draft", amountVnd: 10 },
                { status: "draft", amountVnd: null },
                { status: "confirmed", amountVnd: 5 },
                { status: "paid", amountVnd: 7 },
                { status: "cancelled", amountVnd: 99 },
            ]),
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
        expect(salesFiguresOf({}, [])).toEqual({
            openCount: 0,
            proposalCount: 0,
            proposalValueVnd: 0,
            closedCount: 0,
            closedValueVnd: 0,
            conversion: 0,
        })
    })
})

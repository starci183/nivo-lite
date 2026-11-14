import { membersFixtureProps } from "../fixtures/members.fixtures"
import { loyaltyBlocks } from "./loyalty-blocks"
import { loyaltyMembersBlock } from "./members.block"

describe("sales.loyalty-members", () => {
    it("takes the words of the list and the names of the five params it writes", () => {
        expect(loyaltyMembersBlock.props.safeParse(membersFixtureProps).success).toBe(true)
        expect(loyaltyMembersBlock.params).toEqual([
            "searchParam",
            "tierParam",
            "activityParam",
            "sortParam",
            "selectParam",
        ])
    })

    it("refuses a missing param and a param that is not a name, and takes the quiet tab as an option", () => {
        const { tierParam: _tierParam, ...missing } = membersFixtureProps
        expect(loyaltyMembersBlock.props.safeParse(missing).success).toBe(false)
        expect(loyaltyMembersBlock.props.safeParse({ ...membersFixtureProps, sortParam: "a b" }).success).toBe(false)
        expect(loyaltyMembersBlock.props.safeParse({ ...membersFixtureProps, showAtRisk: false }).success).toBe(true)
    })

    it("binds the members, the ladder and the tier counts, and the activity counts as an option", () => {
        expect(Object.keys(loyaltyMembersBlock.slots)).toEqual(["rows", "tiers", "tierCounts", "activityCounts"])
        expect(loyaltyMembersBlock.slots.activityCounts.required).toBe(false)
        expect(loyaltyBlocks).toEqual([loyaltyMembersBlock])
    })
})

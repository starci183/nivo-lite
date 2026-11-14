import { loyaltyMembersBlock } from "../../../blocks/sales/loyalty/members.block"
import { countsView } from "../../../rows/filter-tabs"
import { memberEntriesOf, memberTabsOf, tiersView } from "../../../rules/sales/loyalty/members-view"
import { MEMBER_RECORDS, membersFixtureProps, membersFixtures } from "./members.fixtures"

describe("the members fixtures", () => {
    it("are props the block accepts", () => {
        expect(loyaltyMembersBlock.props.safeParse(membersFixtureProps).success).toBe(true)
    })

    it("hold the five states of the block", () => {
        expect(Object.keys(membersFixtures)).toEqual(["ready", "loading", "empty", "error", "waiting"])
    })

    it("draw the ladder and the counts of the ready state as tabs", () => {
        const { tiers, tierCounts, activityCounts, rows } = membersFixtures.ready
        if (!("items" in tiers && "items" in tierCounts && "items" in activityCounts && "items" in rows)) {
            expect(membersFixtures.ready).toHaveProperty("rows.items")
            return
        }
        expect(tiersView.safeParse(tiers.items).success).toBe(true)
        expect(countsView.safeParse(tierCounts.items).success).toBe(true)
        const tabs = memberTabsOf(tiers.items, tierCounts.items, activityCounts.items, { all: "a", atRisk: "r" }, true)
        expect(tabs.map((tab) => tab.id)).toEqual(["all", "gold", "silver", "bronze", "at_risk"])
        expect(memberEntriesOf(rows.items)).toHaveLength(MEMBER_RECORDS.length)
    })

    it("show only the members who went quiet in the waiting state", () => {
        const rows = membersFixtures.waiting.rows
        expect(rows).toHaveProperty("items")
        expect("items" in rows ? memberEntriesOf(rows.items).every((member) => member.isAtRisk) : false).toBe(true)
    })
})

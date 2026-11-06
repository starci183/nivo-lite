import {
    AT_RISK,
    MEMBER_SORTS,
    maskedContact,
    memberEntriesOf,
    memberLineOf,
    memberTabsOf,
    nextParamWrite,
    paramsOfTab,
    selectedMemberTab,
    sortKeyOf,
    tiersView,
} from "./members-view"

const LADDER = [
    { key: "gold", name: "Gold" },
    { key: "silver", name: "Silver" },
]
const WORDS = { all: "All", atRisk: "At risk" }
const TIER_COUNTS = { counts: { gold: 84, silver: 312 }, total: 1_086 }

describe("the tiers of the ladder", () => {
    it("are read with their key and name, other fields allowed", () => {
        expect(tiersView.safeParse([{ key: "gold", name: "Gold", count: 3 }]).success).toBe(true)
    })

    it("are refused without a key, and past the longest ladder", () => {
        expect(tiersView.safeParse([{ key: "", name: "x" }]).success).toBe(false)
        expect(tiersView.safeParse(Array.from({ length: 21 }, () => ({ key: "k", name: "n" }))).success).toBe(false)
    })
})

describe("memberTabsOf", () => {
    it("lists all, each tier of the ladder in its order, and the quiet members, each with its count", () => {
        expect(memberTabsOf(LADDER, TIER_COUNTS, { counts: { at_risk: 96 }, total: 1_086 }, WORDS, true)).toEqual([
            { id: "all", label: "All", count: 1_086 },
            { id: "gold", label: "Gold", count: 84 },
            { id: "silver", label: "Silver", count: 312 },
            { id: AT_RISK, label: "At risk", count: 96, isAttention: true },
        ])
    })

    it("counts a tier the counts do not name as none, and warns of nobody when no one has gone quiet", () => {
        const tabs = memberTabsOf(LADDER, { counts: {}, total: 0 }, { counts: {}, total: 0 }, WORDS, true)
        expect(tabs.map((tab) => tab.count)).toEqual([0, 0, 0, 0])
        expect(tabs[3]).toEqual({ id: AT_RISK, label: "At risk", count: 0 })
    })

    it("keeps the words and no counts while the counts are unknown", () => {
        expect(memberTabsOf(LADDER, null, null, WORDS, true)).toEqual([
            { id: "all", label: "All" },
            { id: "gold", label: "Gold" },
            { id: "silver", label: "Silver" },
            { id: AT_RISK, label: "At risk" },
        ])
    })

    it("leaves the quiet members' tab out when the spec does not show it", () => {
        expect(memberTabsOf(LADDER, TIER_COUNTS, null, WORDS, false).map((tab) => tab.id)).toEqual([
            "all",
            "gold",
            "silver",
        ])
    })
})

describe("selectedMemberTab", () => {
    it("names the quiet members, a tier of the ladder or all", () => {
        expect(selectedMemberTab({ tier: null, activity: AT_RISK }, LADDER, true)).toBe(AT_RISK)
        expect(selectedMemberTab({ tier: "silver", activity: null }, LADDER, true)).toBe("silver")
        expect(selectedMemberTab({ tier: null, activity: null }, LADDER, true)).toBe("all")
    })

    it("falls back to all for a tier the ladder lacks and for a hidden quiet tab", () => {
        expect(selectedMemberTab({ tier: "bronze", activity: null }, LADDER, true)).toBe("all")
        expect(selectedMemberTab({ tier: null, activity: AT_RISK }, LADDER, false)).toBe("all")
    })
})

describe("paramsOfTab and nextParamWrite", () => {
    it("map a tab to the two params", () => {
        expect(paramsOfTab("all")).toEqual({ tier: null, activity: null })
        expect(paramsOfTab(AT_RISK)).toEqual({ tier: null, activity: AT_RISK })
        expect(paramsOfTab("gold")).toEqual({ tier: "gold", activity: null })
    })

    it("write one param at a time, the tier first, until the params are where the tab wants them", () => {
        const target = paramsOfTab(AT_RISK)
        const start = { tier: "gold", activity: null }
        expect(nextParamWrite(start, target)).toEqual({ param: "tier", value: null })
        expect(nextParamWrite({ tier: null, activity: null }, target)).toEqual({ param: "activity", value: AT_RISK })
        expect(nextParamWrite(target, target)).toBeNull()
    })
})

describe("maskedContact", () => {
    it("hides the middle of a phone, drawing the international form as the national one", () => {
        expect(maskedContact("0912 345 418")).toBe("0912 *** 418")
        expect(maskedContact("84912345418")).toBe("0912 *** 418")
    })

    it("keeps the first letter and the domain of an email", () => {
        expect(maskedContact("lan@mail.vn")).toBe("l***@mail.vn")
    })

    it("leaves a short value and nothing as they are", () => {
        expect(maskedContact("12345")).toBe("12345")
        expect(maskedContact("")).toBe("")
    })
})

describe("memberEntriesOf", () => {
    it("reads a member with the contact hidden and the quiet ones marked", () => {
        expect(
            memberEntriesOf([
                {
                    id: "m1",
                    name: "Lan",
                    contact: "0912345418",
                    tier: "Gold",
                    points: 4_250,
                    lastVisitAt: "2026-11-01T03:00:00.000Z",
                    activity: "active",
                },
                { id: "m2", name: "Vy", points: "many", activity: "at_risk" },
            ]),
        ).toEqual([
            {
                id: "m1",
                name: "Lan",
                contact: "0912 *** 418",
                tier: "Gold",
                points: 4_250,
                lastVisitAt: "2026-11-01T03:00:00.000Z",
                isAtRisk: false,
            },
            { id: "m2", name: "Vy", contact: "", tier: "", points: 0, lastVisitAt: "", isAtRisk: true },
        ])
    })

    it("leaves out a record with no id", () => {
        expect(memberEntriesOf([{ name: "No id" }])).toEqual([])
    })
})

describe("memberLineOf and the sorts", () => {
    it("joins the contact and the last purchase, leaving out the one that is missing", () => {
        const entry = memberEntriesOf([{ id: "m1", contact: "0912345418" }])[0]
        expect(entry && memberLineOf(entry, "last bought 01/11")).toBe("0912 *** 418 \u00b7 last bought 01/11")
        expect(entry && memberLineOf(entry, "")).toBe("0912 *** 418")
    })

    it("offer the four sorts of the members read, each with a message key of its own", () => {
        expect(MEMBER_SORTS).toEqual(["points", "recent", "spend", "name"])
        expect(MEMBER_SORTS.map(sortKeyOf)).toEqual([
            "members_sort_points",
            "members_sort_recent",
            "members_sort_spend",
            "members_sort_name",
        ])
    })
})

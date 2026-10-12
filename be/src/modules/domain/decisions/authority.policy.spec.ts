import { builder } from "@starci/jest-preset"
import { mergeAuthority } from "./authority.policy"
import type { AuthorityProfile } from "./decisions-views.contracts"

const profileOf = builder<AuthorityProfile>({
    policies: "P",
    reply_style: "R",
    brand_voice: "B",
    limits_note: "L",
    goal_revenue_vnd: 100,
    goal_new_customers: 5,
    goal_first_reply_minutes: 10,
    goal_note: "N",
    updated_by: "An",
    updated_at: "2026-10-12T10:00:00.000Z",
})

describe("mergeAuthority", () => {
    it("starts from an empty sheet", () => {
        expect(mergeAuthority(null, {})).toEqual({
            policies: "",
            reply_style: "",
            brand_voice: "",
            limits_note: "",
            goal_revenue_vnd: null,
            goal_new_customers: null,
            goal_first_reply_minutes: null,
            goal_note: "",
        })
    })

    it("keeps what the patch leaves out", () => {
        expect(mergeAuthority(profileOf(), { policies: "P2" })).toEqual({
            policies: "P2",
            reply_style: "R",
            brand_voice: "B",
            limits_note: "L",
            goal_revenue_vnd: 100,
            goal_new_customers: 5,
            goal_first_reply_minutes: 10,
            goal_note: "N",
        })
    })

    it("lays every field of the patch over the sheet and lets a goal be cleared", () => {
        expect(
            mergeAuthority(profileOf(), {
                policies: "p",
                reply_style: "r",
                brand_voice: "b",
                limits_note: "l",
                goal_revenue_vnd: null,
                goal_new_customers: 9,
                goal_first_reply_minutes: null,
                goal_note: "n",
            }),
        ).toEqual({
            policies: "p",
            reply_style: "r",
            brand_voice: "b",
            limits_note: "l",
            goal_revenue_vnd: null,
            goal_new_customers: 9,
            goal_first_reply_minutes: null,
            goal_note: "n",
        })
    })

    it("keeps a goal that is stored as null", () => {
        expect(mergeAuthority(profileOf({ goal_revenue_vnd: null }), {}).goal_revenue_vnd).toBeNull()
    })
})

import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { loyaltyCopy, loyaltyList, loyaltyText } from "./copy"
import { LOYALTY_SERVER, LOYALTY_TEMPLATE } from "./loyalty.template"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

describe("the Loyalty template copy", () => {
    it("reads one message in its language", () => {
        expect(loyaltyCopy("name", "en")).toBe(en.name)
        expect(loyaltyCopy("name", "vi")).toBe(vi.name)
    })

    it("reads a message and a list in both languages", () => {
        expect(loyaltyText("shortName")).toEqual({ vi: vi.shortName, en: en.shortName })
        expect(loyaltyList(["points.0", "points.1"])).toEqual({
            vi: [vi["points.0"], vi["points.1"]],
            en: [en["points.0"], en["points.1"]],
        })
    })

    it("holds the same keys in both languages", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })
})

describe("LOYALTY_SERVER", () => {
    it("is a module list the host may load", () => {
        expect(moduleListProblems([LOYALTY_SERVER])).toEqual([])
    })

    it("keeps the catalogue entry the app had: key, order, workbench and settings", () => {
        expect(LOYALTY_TEMPLATE).toMatchObject({
            key: "loyalty",
            order: 70,
            audience: "customer",
            workbench: "loyalty",
            settingsExtras: null,
        })
    })

    it("governs every command it accepts with one of its own actions", () => {
        const actions = LOYALTY_TEMPLATE.authorityActions.map((action) => action.action)
        expect(actions).toEqual(["award_points", "redeem_reward", "send_promo", "adjust_points"])
        expect(LOYALTY_TEMPLATE.accepts.every((command) => actions.includes(command.action))).toBe(true)
    })
})

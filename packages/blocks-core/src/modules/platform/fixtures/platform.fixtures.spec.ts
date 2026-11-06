import { PLATFORM_MESSAGES } from "../platform-messages"
import { PARKED_RUNS_VIEW, PARKED_RUNS_VIEW_EN, PLATFORM_FIXTURES } from "./platform.fixtures"

const parkedKeys = (words: Readonly<Record<string, string>>): Array<string> =>
    Object.keys(words)
        .filter((key) => key.startsWith("parked_"))
        .toSorted((left, right) => left.localeCompare(right))

describe("the parked runs fixture", () => {
    it("speaks Vietnamese by default and English for a viewer in English, with the words of the platform messages", () => {
        expect(PARKED_RUNS_VIEW.rows[0]?.step).toBe(PLATFORM_MESSAGES.vi["parked_step_confirm"])
        expect(PARKED_RUNS_VIEW.rows[0]?.errorWords).toBe(PLATFORM_MESSAGES.vi["parked_error_delivery_failed"])
        expect(PARKED_RUNS_VIEW_EN.rows[1]?.step).toBe(PLATFORM_MESSAGES.en["parked_step_notify"])
        expect(PARKED_RUNS_VIEW_EN.rows[1]?.errorWords).toBe(PLATFORM_MESSAGES.en["parked_error_timeout"])
        expect(PLATFORM_FIXTURES.reads["platform.parked-runs"]?.readyIn).toEqual({
            vi: PARKED_RUNS_VIEW,
            en: PARKED_RUNS_VIEW_EN,
        })
    })

    it("has every word it needs in both languages", () => {
        expect(parkedKeys(PLATFORM_MESSAGES.vi)).toEqual(parkedKeys(PLATFORM_MESSAGES.en))
        expect(parkedKeys(PLATFORM_MESSAGES.vi)).toHaveLength(4)
    })
})

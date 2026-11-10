import { SAME_FACT_CANDIDATES, SAME_FACT_PROMPT, SAME_MEANING_DISTANCE, sameFactOf, sameFactPrompt } from "./same-fact.policy"

const line = (subjectLabel: string, attributeLabel: string, value: string) => ({ subjectLabel, attributeLabel, value, unit: null })

describe("same-fact.policy: the one cheap judgement of 'the same fact in other words'", () => {
    it("keeps its distance and candidate count explicit", () => {
        expect([SAME_MEANING_DISTANCE, SAME_FACT_CANDIDATES]).toEqual([0.25, 3])
    })

    it("asks about one new line against numbered known lines", () => {
        expect(
            sameFactPrompt(line("B\u00f3 h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng", "Gi\u00e1", "400.000 \u0111"), [
                line("B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng", "Gi\u00e1", "350.000 \u0111"),
                { ...line("Ti\u1ec7m hoa NIVO", "Gi\u1edd m\u1edf c\u1eeda", "8:00"), unit: "h" },
            ]),
        ).toBe(
            "NEW: B\u00f3 h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 400.000 \u0111\nKNOWN:\n" +
                "1. B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 350.000 \u0111\n2. Ti\u1ec7m hoa NIVO - Gi\u1edd m\u1edf c\u1eeda: 8:00 h",
        )
    })

    it("says what is NOT the same, and that differing values are still the same fact", () => {
        expect(SAME_FACT_PROMPT).toContain("The values may differ")
        expect(SAME_FACT_PROMPT).toContain("10 roses vs 20 roses")
        expect(SAME_FACT_PROMPT).toContain("When unsure, answer null")
    })

    it.each([
        [{ same: 1 }, 2, 0],
        [{ same: 2 }, 2, 1],
        [{ same: 3 }, 2, null],
        [{ same: 0 }, 2, null],
        [{ same: 1.5 }, 2, null],
        [{ same: "1" }, 2, null],
        [{ same: null }, 2, null],
        [null, 2, null],
        [[1], 2, null],
    ])("reads %j over %i candidates as %s", (answer, count, expected) => {
        expect(sameFactOf(answer, count)).toBe(expected)
    })
})

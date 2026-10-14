import type { Criteria, Identity, Requirement, Signals } from "./lead-flows.contracts"
import {
    cleanSignals,
    DEFAULT_CRITERIA,
    EMPTY_SIGNALS,
    handoffReady,
    MAX_QUESTIONS,
    mergeSignals,
    parseCriteria,
    parseQuestions,
    recordOf,
    scoreLead,
    setupKindOf,
} from "./lead-flow-score.policy"

const identity: Identity = { phone: null, email: null, psid: null, igsid: null }
const interested: Signals = {
    need: "a consultation",
    contact: "84901234567",
    budget: "fit",
    timeline: "soon",
    area: "fit",
    asks_price_or_schedule: true,
    wants_meeting: true,
    interest: "high",
}

describe("lead flow score policy", () => {
    describe("parseQuestions", () => {
        it("cleans list prefixes, blank lines and duplicate questions, keeping at most four", () => {
            expect(MAX_QUESTIONS).toBe(4)
            expect(parseQuestions("1. First?\n\n- Second?\n* Third?\n4) Fourth?\n5: Fifth?\n- First?")).toEqual([
                "First?",
                "Second?",
                "Third?",
                "Fourth?",
            ])
        })

        it("splits a paragraph and questions sharing a list line, applying a custom maximum", () => {
            expect(parseQuestions("  Need?   Budget? Timeline?", 2)).toEqual(["Need?", "Budget?"])
            expect(parseQuestions("1. Need? Budget?\n2. Area?")).toEqual(["Need?", "Budget?", "Area?"])
        })

        it("keeps a single question or unpunctuated question and accepts no questions", () => {
            expect(parseQuestions("\n  What   do you need?\n")).toEqual(["What do you need?"])
            expect(parseQuestions("  Tell   us your need ")).toEqual(["Tell us your need"])
            expect(parseQuestions(" \r\n \n")).toEqual([])
            expect(parseQuestions("Question?", 0)).toEqual([])
        })
    })

    describe("parseCriteria", () => {
        it("uses safe defaults when a hot segment has no recognized signals", () => {
            expect(parseCriteria("warm need; cold uninterested")).toEqual(DEFAULT_CRITERIA)
            expect(parseCriteria("hot great leads", "Bangkok city")).toEqual({ ...DEFAULT_CRITERIA, areaMatters: true })
            expect(parseCriteria("our area; hot great leads")).toEqual({ ...DEFAULT_CRITERIA, areaMatters: true })
        })

        it("reads all recognized signals and sorts level markers in written order", () => {
            expect(
                parseCriteria(
                    "warm contact need budget; cold uninterested; hot contact price budget soon city meet need",
                ),
            ).toEqual({
                hot: {
                    all: [
                        "need",
                        "contact",
                        "asks_price_or_schedule",
                        "budget_fit",
                        "timeline_soon",
                        "area_fit",
                        "wants_meeting",
                    ],
                    any: [],
                },
                warm: { all: ["contact", "need"] },
                areaMatters: false,
            })
        })

        it("separates price alternatives, ignores repeated signals and supplies the warm default", () => {
            expect(parseCriteria("hot contact price or soon contact; warm budget")).toEqual({
                hot: { all: ["need", "contact"], any: ["asks_price_or_schedule", "timeline_soon"] },
                warm: { all: ["need"] },
                areaMatters: false,
            })
            expect(parseCriteria("hot price or soon")).toEqual({
                hot: { all: ["need"], any: ["asks_price_or_schedule", "timeline_soon"] },
                warm: { all: ["need"] },
                areaMatters: false,
            })
        })

        it("retains price as required when or introduces no new signal and folds Vietnamese accents", () => {
            expect(
                parseCriteria(
                    "N\u00f3ng: c\u1ea7n b\u00e1o gi\u00e1 ho\u1eb7c gi\u00e1; \u1ea4m: nhu c\u1ea7u",
                    "city",
                ),
            ).toEqual({
                hot: { all: ["need", "asks_price_or_schedule"], any: [] },
                warm: { all: ["need"] },
                areaMatters: false,
            })
        })
    })

    describe("setupKindOf", () => {
        it.each([
            ["CAU-HOI-SANG-LOC", "questions"],
            ["qualification-question", "questions"],
            ["qualifying-question", "questions"],
            ["nong-am-lanh", "criteria"],
            ["hot-warm-cold", "criteria"],
            ["tieu-chi-khach", "criteria"],
            ["khach-hang-ly-tuong", "icp"],
            ["ideal-customer", "icp"],
            ["unrelated", null],
        ] as const)("classifies %s", (attribute, expected) => {
            expect(setupKindOf(attribute)).toBe(expected)
        })
    })

    describe("recordOf and cleanSignals", () => {
        it("keeps record identity and uses no fields for other shapes", () => {
            const record = { need: "need" }
            expect(recordOf(record)).toBe(record)
            expect(recordOf(null)).toEqual({})
            expect(recordOf([record])).toEqual({})
            expect(recordOf(4)).toEqual({})
            expect(cleanSignals(undefined)).toEqual(EMPTY_SIGNALS)
        })

        it("trims and truncates need, prioritizes phone over email, and preserves valid signal values", () => {
            expect(
                cleanSignals({ ...interested, need: `  ${"n".repeat(210)}  `, contact: "0901 234 567; A@B.test" }),
            ).toEqual({ ...interested, need: "n".repeat(200), contact: "84901234567" })
        })

        it("uses an email when no phone is found and treats malformed fields safely", () => {
            expect(
                cleanSignals({
                    need: "  ",
                    contact: "  A@B.TEST  ",
                    budget: "low",
                    timeline: "later",
                    area: "outside",
                    interest: "none",
                    asks_price_or_schedule: "true",
                    wants_meeting: 1,
                }),
            ).toEqual({
                ...EMPTY_SIGNALS,
                contact: "a@b.test",
                budget: "low",
                timeline: "later",
                area: "outside",
                interest: "none",
            })
            expect(
                cleanSignals({
                    need: 4,
                    contact: "not a contact",
                    budget: "bad",
                    timeline: null,
                    area: false,
                    interest: 1,
                }),
            ).toEqual(EMPTY_SIGNALS)
        })
    })

    describe("mergeSignals", () => {
        it("retains known values when the new signals carry no usable update", () => {
            expect(mergeSignals(interested, EMPTY_SIGNALS)).toEqual(interested)
        })

        it("accepts new values and intent while preserving false intent when neither turn has it", () => {
            expect(mergeSignals(EMPTY_SIGNALS, interested)).toEqual(interested)
            expect(mergeSignals(EMPTY_SIGNALS, EMPTY_SIGNALS)).toEqual(EMPTY_SIGNALS)
            const next: Signals = {
                ...EMPTY_SIGNALS,
                need: "new need",
                contact: "a@b.test",
                budget: "low",
                timeline: "later",
                area: "outside",
                interest: "low",
            }
            expect(mergeSignals(interested, next)).toEqual({
                ...next,
                asks_price_or_schedule: true,
                wants_meeting: true,
            })
        })
    })

    describe("scoreLead", () => {
        it("rejects lack of interest before area and rejects a lead outside an area that matters", () => {
            const criteria: Criteria = { ...DEFAULT_CRITERIA, areaMatters: true }
            expect(scoreLead({ ...interested, interest: "none", area: "outside" }, criteria)).toEqual({
                level: "cold",
                reasons: ["not interested"],
                missing: [],
            })
            expect(scoreLead({ ...interested, area: "outside" }, criteria)).toEqual({
                level: "cold",
                reasons: ["outside the service area"],
                missing: [],
            })
            expect(scoreLead(interested, criteria)).toEqual({
                level: "hot",
                reasons: ["contact", "need", "asks_price_or_schedule", "timeline_soon", "budget_fit", "wants_meeting"],
                missing: [],
            })
        })

        it("gives hot scores for every required signal, including all fulfilled alternatives", () => {
            const requirements: ReadonlyArray<Requirement> = [
                "contact",
                "need",
                "budget_fit",
                "timeline_soon",
                "area_fit",
                "asks_price_or_schedule",
                "wants_meeting",
                "interest_high",
            ]
            const criteria: Criteria = {
                hot: { all: requirements, any: [] },
                warm: { all: ["need"] },
                areaMatters: false,
            }
            expect(scoreLead(interested, criteria)).toEqual({ level: "hot", reasons: requirements, missing: [] })
            expect(
                scoreLead({ ...EMPTY_SIGNALS, need: "a quote", contact: "a@b.test", asks_price_or_schedule: true }),
            ).toEqual({ level: "hot", reasons: ["contact", "need", "asks_price_or_schedule"], missing: [] })
        })

        it("reports each unsatisfied requirement and rejects empty contact and need", () => {
            const requirements: ReadonlyArray<Requirement> = [
                "contact",
                "need",
                "budget_fit",
                "timeline_soon",
                "area_fit",
                "asks_price_or_schedule",
                "wants_meeting",
                "interest_high",
            ]
            const criteria: Criteria = { hot: { all: requirements, any: [] }, warm: { all: [] }, areaMatters: false }
            const expected = {
                level: "warm",
                reasons: [`missing for hot: ${requirements.join(", ")}`],
                missing: requirements,
            }
            expect(scoreLead(EMPTY_SIGNALS, criteria)).toEqual(expected)
            expect(scoreLead({ ...EMPTY_SIGNALS, contact: "", need: "" }, criteria)).toEqual(expected)
        })

        it("lists the first unmet alternative along with missing required signals", () => {
            expect(scoreLead({ ...EMPTY_SIGNALS, need: "a quote" })).toEqual({
                level: "warm",
                reasons: ["missing for hot: contact, asks_price_or_schedule"],
                missing: ["contact", "asks_price_or_schedule"],
            })
            expect(scoreLead({ ...EMPTY_SIGNALS, need: "a quote", contact: "a@b.test" })).toEqual({
                level: "warm",
                reasons: ["missing for hot: asks_price_or_schedule"],
                missing: ["asks_price_or_schedule"],
            })
        })

        it("allows strong interest to qualify as warm despite absent warm requirements", () => {
            expect(scoreLead({ ...EMPTY_SIGNALS, interest: "high", timeline: "soon" })).toEqual({
                level: "warm",
                reasons: ["missing for hot: contact, need"],
                missing: ["contact", "need"],
            })
        })

        it("keeps the placeholder when a sparse alternative supplies no requirement text", () => {
            const alternatives: Array<Requirement> = []
            alternatives.length = 1
            const criteria: Criteria = { hot: { all: [], any: alternatives }, warm: { all: [] }, areaMatters: false }
            expect(scoreLead(EMPTY_SIGNALS, criteria)).toStrictEqual({
                level: "warm",
                reasons: ["missing for hot: -"],
                missing: [undefined],
            })
        })

        it("gives cold scores for low interest or no clear need with exact missing signals", () => {
            expect(scoreLead({ ...EMPTY_SIGNALS, need: "a quote", interest: "low" })).toEqual({
                level: "cold",
                reasons: ["low interest"],
                missing: ["contact", "asks_price_or_schedule"],
            })
            expect(scoreLead(EMPTY_SIGNALS)).toEqual({
                level: "cold",
                reasons: ["no clear need yet"],
                missing: ["contact", "need", "asks_price_or_schedule"],
            })
            expect(scoreLead({ ...EMPTY_SIGNALS, interest: "low" })).toEqual({
                level: "cold",
                reasons: ["low interest"],
                missing: ["contact", "need", "asks_price_or_schedule"],
            })
        })
    })

    describe("handoffReady", () => {
        it("prefers the signal contact, then phone, email, Messenger and Instagram identity", () => {
            const flow: Identity = { phone: "phone", email: "email", psid: "psid", igsid: "igsid" }
            expect(handoffReady(interested, flow)).toEqual({ ok: true, contact: "84901234567", need: "a consultation" })
            const signals: Signals = { ...EMPTY_SIGNALS, need: "a quote" }
            expect(handoffReady(signals, flow)).toEqual({ ok: true, contact: "phone", need: "a quote" })
            expect(handoffReady(signals, { ...flow, phone: null })).toEqual({
                ok: true,
                contact: "email",
                need: "a quote",
            })
            expect(handoffReady(signals, { ...flow, phone: null, email: null })).toEqual({
                ok: true,
                contact: "psid",
                need: "a quote",
            })
            expect(handoffReady(signals, { ...identity, igsid: "igsid" })).toEqual({
                ok: true,
                contact: "igsid",
                need: "a quote",
            })
        })

        it("requires a nonnull contact and need", () => {
            expect(handoffReady({ ...EMPTY_SIGNALS, need: "a quote" }, identity)).toEqual({
                ok: false,
                contact: null,
                need: "a quote",
            })
            expect(handoffReady({ ...EMPTY_SIGNALS, contact: "a@b.test" }, identity)).toEqual({
                ok: false,
                contact: "a@b.test",
                need: null,
            })
        })
    })
})

import { Test } from "@nestjs/testing"
import type { Criteria, Identity, Requirement, Signals } from "./lead-flows.contracts"
import {
    DEFAULT_CRITERIA,
    EMPTY_SIGNALS,
    MAX_QUESTIONS,
    parseQuestions as realParseQuestions,
    parseCriteria as realParseCriteria,
    setupKindOf as realSetupKindOf,
    recordOf as realRecordOf,
    cleanSignals as realCleanSignals,
    mergeSignals as realMergeSignals,
    scoreLead as realScoreLead,
    handoffReady as realHandoffReady,
} from "./lead-flow-score.policy"

const SUBJECT = Symbol("lead-flow-score.policy")

type Subject = Pick<
    typeof import("./lead-flow-score.policy"),
    | "parseQuestions"
    | "parseCriteria"
    | "setupKindOf"
    | "recordOf"
    | "cleanSignals"
    | "mergeSignals"
    | "scoreLead"
    | "handoffReady"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseQuestions: realParseQuestions,
                    parseCriteria: realParseCriteria,
                    setupKindOf: realSetupKindOf,
                    recordOf: realRecordOf,
                    cleanSignals: realCleanSignals,
                    mergeSignals: realMergeSignals,
                    scoreLead: realScoreLead,
                    handoffReady: realHandoffReady,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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

describe("lead flow score policy / parseQuestions", () => {
    it("cleans list prefixes, blank lines and duplicate questions, keeping at most four", async () => {
        const subject = await build()

        expect(MAX_QUESTIONS).toBe(4)
        expect(subject.parseQuestions("1. First?\n\n- Second?\n* Third?\n4) Fourth?\n5: Fifth?\n- First?")).toEqual([
            "First?",
            "Second?",
            "Third?",
            "Fourth?",
        ])
    })
    it("splits a paragraph and questions sharing a list line, applying a custom maximum", async () => {
        const subject = await build()

        expect(subject.parseQuestions("  Need?   Budget? Timeline?", 2)).toEqual(["Need?", "Budget?"])
        expect(subject.parseQuestions("1. Need? Budget?\n2. Area?")).toEqual(["Need?", "Budget?", "Area?"])
    })
    it("keeps a single question or unpunctuated question and accepts no questions", async () => {
        const subject = await build()

        expect(subject.parseQuestions("\n  What   do you need?\n")).toEqual(["What do you need?"])
        expect(subject.parseQuestions("  Tell   us your need ")).toEqual(["Tell us your need"])
        expect(subject.parseQuestions(" \r\n \n")).toEqual([])
        expect(subject.parseQuestions("Question?", 0)).toEqual([])
    })
})

describe("lead flow score policy / parseCriteria", () => {
    it("uses safe defaults when a hot segment has no recognized signals", async () => {
        const subject = await build()

        expect(subject.parseCriteria("warm need; cold uninterested")).toEqual(DEFAULT_CRITERIA)
        expect(subject.parseCriteria("hot great leads", "Bangkok city")).toEqual({
            ...DEFAULT_CRITERIA,
            areaMatters: true,
        })
        expect(subject.parseCriteria("our area; hot great leads")).toEqual({ ...DEFAULT_CRITERIA, areaMatters: true })
    })
    it("reads all recognized signals and sorts level markers in written order", async () => {
        const subject = await build()

        expect(
            subject.parseCriteria(
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
    it("separates price alternatives, ignores repeated signals and supplies the warm default", async () => {
        const subject = await build()

        expect(subject.parseCriteria("hot contact price or soon contact; warm budget")).toEqual({
            hot: { all: ["need", "contact"], any: ["asks_price_or_schedule", "timeline_soon"] },
            warm: { all: ["need"] },
            areaMatters: false,
        })
        expect(subject.parseCriteria("hot price or soon")).toEqual({
            hot: { all: ["need"], any: ["asks_price_or_schedule", "timeline_soon"] },
            warm: { all: ["need"] },
            areaMatters: false,
        })
    })
    it("retains price as required when or introduces no new signal and folds Vietnamese accents", async () => {
        const subject = await build()

        expect(
            subject.parseCriteria(
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

describe("lead flow score policy / setupKindOf", () => {
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
    ] as const)("classifies %s", async (attribute, expected) => {
        const subject = await build()

        expect(subject.setupKindOf(attribute)).toBe(expected)
    })
})

describe("lead flow score policy / recordOf and cleanSignals", () => {
    it("keeps record identity and uses no fields for other shapes", async () => {
        const subject = await build()

        const record = { need: "need" }
        expect(subject.recordOf(record)).toBe(record)
        expect(subject.recordOf(null)).toEqual({})
        expect(subject.recordOf([record])).toEqual({})
        expect(subject.recordOf(4)).toEqual({})
        expect(subject.cleanSignals(undefined)).toEqual(EMPTY_SIGNALS)
    })
    it("trims and truncates need, prioritizes phone over email, and preserves valid signal values", async () => {
        const subject = await build()

        expect(
            subject.cleanSignals({ ...interested, need: `  ${"n".repeat(210)}  `, contact: "0901 234 567; A@B.test" }),
        ).toEqual({ ...interested, need: "n".repeat(200), contact: "84901234567" })
    })
    it("uses an email when no phone is found and treats malformed fields safely", async () => {
        const subject = await build()

        expect(
            subject.cleanSignals({
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
            subject.cleanSignals({
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

describe("lead flow score policy / mergeSignals", () => {
    it("retains known values when the new signals carry no usable update", async () => {
        const subject = await build()

        expect(subject.mergeSignals(interested, EMPTY_SIGNALS)).toEqual(interested)
    })
    it("accepts new values and intent while preserving false intent when neither turn has it", async () => {
        const subject = await build()

        expect(subject.mergeSignals(EMPTY_SIGNALS, interested)).toEqual(interested)
        expect(subject.mergeSignals(EMPTY_SIGNALS, EMPTY_SIGNALS)).toEqual(EMPTY_SIGNALS)
        const next: Signals = {
            ...EMPTY_SIGNALS,
            need: "new need",
            contact: "a@b.test",
            budget: "low",
            timeline: "later",
            area: "outside",
            interest: "low",
        }
        expect(subject.mergeSignals(interested, next)).toEqual({
            ...next,
            asks_price_or_schedule: true,
            wants_meeting: true,
        })
    })
})

describe("lead flow score policy / scoreLead", () => {
    it("rejects lack of interest before area and rejects a lead outside an area that matters", async () => {
        const subject = await build()

        const criteria: Criteria = { ...DEFAULT_CRITERIA, areaMatters: true }
        expect(subject.scoreLead({ ...interested, interest: "none", area: "outside" }, criteria)).toEqual({
            level: "cold",
            reasons: ["not interested"],
            missing: [],
        })
        expect(subject.scoreLead({ ...interested, area: "outside" }, criteria)).toEqual({
            level: "cold",
            reasons: ["outside the service area"],
            missing: [],
        })
        expect(subject.scoreLead(interested, criteria)).toEqual({
            level: "hot",
            reasons: ["contact", "need", "asks_price_or_schedule", "timeline_soon", "budget_fit", "wants_meeting"],
            missing: [],
        })
    })
    it("gives hot scores for every required signal, including all fulfilled alternatives", async () => {
        const subject = await build()

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
        expect(subject.scoreLead(interested, criteria)).toEqual({ level: "hot", reasons: requirements, missing: [] })
        expect(
            subject.scoreLead({ ...EMPTY_SIGNALS, need: "a quote", contact: "a@b.test", asks_price_or_schedule: true }),
        ).toEqual({ level: "hot", reasons: ["contact", "need", "asks_price_or_schedule"], missing: [] })
    })
})

describe("lead flow score policy / scoreLead", () => {
    it("reports each unsatisfied requirement and rejects empty contact and need", async () => {
        const subject = await build()

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
        expect(subject.scoreLead(EMPTY_SIGNALS, criteria)).toEqual(expected)
        expect(subject.scoreLead({ ...EMPTY_SIGNALS, contact: "", need: "" }, criteria)).toEqual(expected)
    })
})

describe("lead flow score policy / scoreLead", () => {
    it("lists the first unmet alternative along with missing required signals", async () => {
        const subject = await build()

        expect(subject.scoreLead({ ...EMPTY_SIGNALS, need: "a quote" })).toEqual({
            level: "warm",
            reasons: ["missing for hot: contact, asks_price_or_schedule"],
            missing: ["contact", "asks_price_or_schedule"],
        })
        expect(subject.scoreLead({ ...EMPTY_SIGNALS, need: "a quote", contact: "a@b.test" })).toEqual({
            level: "warm",
            reasons: ["missing for hot: asks_price_or_schedule"],
            missing: ["asks_price_or_schedule"],
        })
    })
    it("allows strong interest to qualify as warm despite absent warm requirements", async () => {
        const subject = await build()

        expect(subject.scoreLead({ ...EMPTY_SIGNALS, interest: "high", timeline: "soon" })).toEqual({
            level: "warm",
            reasons: ["missing for hot: contact, need"],
            missing: ["contact", "need"],
        })
    })
    it("keeps the placeholder when a sparse alternative supplies no requirement text", async () => {
        const subject = await build()

        const alternatives: Array<Requirement> = []
        alternatives.length = 1
        const criteria: Criteria = { hot: { all: [], any: alternatives }, warm: { all: [] }, areaMatters: false }
        expect(subject.scoreLead(EMPTY_SIGNALS, criteria)).toStrictEqual({
            level: "warm",
            reasons: ["missing for hot: -"],
            missing: [undefined],
        })
    })
    it("gives cold scores for low interest or no clear need with exact missing signals", async () => {
        const subject = await build()

        expect(subject.scoreLead({ ...EMPTY_SIGNALS, need: "a quote", interest: "low" })).toEqual({
            level: "cold",
            reasons: ["low interest"],
            missing: ["contact", "asks_price_or_schedule"],
        })
        expect(subject.scoreLead(EMPTY_SIGNALS)).toEqual({
            level: "cold",
            reasons: ["no clear need yet"],
            missing: ["contact", "need", "asks_price_or_schedule"],
        })
        expect(subject.scoreLead({ ...EMPTY_SIGNALS, interest: "low" })).toEqual({
            level: "cold",
            reasons: ["low interest"],
            missing: ["contact", "need", "asks_price_or_schedule"],
        })
    })
})

describe("lead flow score policy / handoffReady", () => {
    it("prefers the signal contact, then phone, email, Messenger and Instagram identity", async () => {
        const subject = await build()

        const flow: Identity = { phone: "phone", email: "email", psid: "psid", igsid: "igsid" }
        expect(subject.handoffReady(interested, flow)).toEqual({
            ok: true,
            contact: "84901234567",
            need: "a consultation",
        })
        const signals: Signals = { ...EMPTY_SIGNALS, need: "a quote" }
        expect(subject.handoffReady(signals, flow)).toEqual({ ok: true, contact: "phone", need: "a quote" })
        expect(subject.handoffReady(signals, { ...flow, phone: null })).toEqual({
            ok: true,
            contact: "email",
            need: "a quote",
        })
        expect(subject.handoffReady(signals, { ...flow, phone: null, email: null })).toEqual({
            ok: true,
            contact: "psid",
            need: "a quote",
        })
        expect(subject.handoffReady(signals, { ...identity, igsid: "igsid" })).toEqual({
            ok: true,
            contact: "igsid",
            need: "a quote",
        })
    })
    it("requires a nonnull contact and need", async () => {
        const subject = await build()

        expect(subject.handoffReady({ ...EMPTY_SIGNALS, need: "a quote" }, identity)).toEqual({
            ok: false,
            contact: null,
            need: "a quote",
        })
        expect(subject.handoffReady({ ...EMPTY_SIGNALS, contact: "a@b.test" }, identity)).toEqual({
            ok: false,
            contact: "a@b.test",
            need: null,
        })
    })
})

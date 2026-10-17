import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import {
    platformOf as realPlatformOf,
    sourceKindOf as realSourceKindOf,
    leadSourceOf as realLeadSourceOf,
    toLeadFlow as realToLeadFlow,
    saveParams as realSaveParams,
} from "./lead-flow.mapper"
import type { Analysis, FlowState, LeadFlow, LeadSource, Signals, SourceKind } from "./lead-flows.contracts"
import type { LeadFlowRow } from "./persistence/lead-flows.rows"

const SUBJECT = Symbol("lead-flow.mapper")

type Subject = Pick<
    typeof import("./lead-flow.mapper"),
    "platformOf" | "sourceKindOf" | "leadSourceOf" | "toLeadFlow" | "saveParams"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    platformOf: realPlatformOf,
                    sourceKindOf: realSourceKindOf,
                    leadSourceOf: realLeadSourceOf,
                    toLeadFlow: realToLeadFlow,
                    saveParams: realSaveParams,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = "2026-10-12T10:00:00.000Z"

const rowOf = builder<LeadFlowRow>({
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: "conversation-1",
    platform: null,
    psid: "person-1",
    igsid: null,
    phone: "84912345678",
    email: "lan@example.com",
    name: "Lan",
    state: "invalid",
    resume_state: null,
    source: null,
    touches: null,
    answers: null,
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: null,
    score: null,
    score_reasons: null,
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: null,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
})

const SIGNALS: Signals = {
    need: null,
    contact: null,
    budget: "unknown",
    timeline: "unknown",
    area: "unknown",
    asks_price_or_schedule: false,
    wants_meeting: false,
    interest: "medium",
}

const EMPTY_FLOW: LeadFlow = {
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: "conversation-1",
    platform: null,
    psid: "person-1",
    igsid: null,
    phone: "84912345678",
    email: "lan@example.com",
    name: "Lan",
    state: "new",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: SIGNALS,
    score: null,
    score_reasons: [],
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: null,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
}

const SOURCE: LeadSource = {
    platform: "instagram",
    kind: "comment",
    post_id: "post-1",
    ad_id: "ad-1",
    form_id: "form-1",
    comment_id: "comment-1",
    leadgen_id: "leadgen-1",
    referral: { ref: "ref-1", source: "ADS", type: "OPEN_THREAD", ad_id: "ad-2" },
    at: NOW,
}

const ANALYSIS: Analysis = {
    turn: "turn-1",
    signals: SIGNALS,
    sentiment: "positive",
    flags: { complaint: false, refund: false, angry: false, asks_real_person: false },
    confidence: 0.9,
    reply: "Happy to help",
    answer: "Tea",
    knowledge_gap: null,
    public_reply: "Thanks",
    private_reply: "Please tell us more",
}

describe("lead flow mapping", () => {
    it.each(["instagram", "facebook", "unknown", null])("recognizes platform %s", async (value) => {
        const subject = await build()

        expect(subject.platformOf(value)).toBe(value === "instagram" ? "instagram" : "facebook")
    })
    it.each<SourceKind>(["leadgen", "dm", "comment", "mention"])("recognizes source kind %s", async (kind) => {
        const subject = await build()

        expect(subject.sourceKindOf(kind, "dm")).toBe(kind)
    })
    it("uses the caller's source fallback for an unrecognized kind", async () => {
        const subject = await build()

        expect(subject.sourceKindOf("invalid", "mention")).toBe("mention")
        expect(subject.sourceKindOf(null, "dm")).toBe("dm")
    })
    it("rejects values with neither a platform nor a kind and defaults missing source fields", async () => {
        const subject = await build()

        expect(subject.leadSourceOf(null)).toBeNull()
        expect(subject.leadSourceOf({})).toBeNull()
        expect(subject.leadSourceOf([])).toBeNull()
        expect(subject.leadSourceOf({ platform: "instagram" })).toEqual({
            platform: "instagram",
            kind: "leadgen",
            post_id: null,
            ad_id: null,
            form_id: null,
            comment_id: null,
            leadgen_id: null,
            referral: null,
            at: null,
        })
        expect(subject.leadSourceOf({ kind: "dm", referral: null })).toEqual({
            platform: "facebook",
            kind: "dm",
            post_id: null,
            ad_id: null,
            form_id: null,
            comment_id: null,
            leadgen_id: null,
            referral: null,
            at: null,
        })
    })
    it("preserves source identifiers and validates the referral shape", async () => {
        const subject = await build()

        expect(subject.leadSourceOf(SOURCE)).toEqual(SOURCE)
        expect(subject.leadSourceOf({ ...SOURCE, referral: "invalid" })).toEqual({ ...SOURCE, referral: null })
        expect(
            subject.leadSourceOf({ ...SOURCE, referral: { ref: "  campaign  ", source: 1, type: "", ad_id: null } }),
        ).toEqual({
            ...SOURCE,
            referral: { ref: "campaign", source: null, type: null, ad_id: null },
        })
    })
})

describe("lead flow mapping", () => {
    it("supplies safe defaults for malformed or missing stored fields", async () => {
        const subject = await build()

        expect(subject.toLeadFlow(rowOf())).toEqual(EMPTY_FLOW)
        expect(
            subject.toLeadFlow(
                rowOf({ touches: {}, answers: "bad", score_reasons: 1, signals: {}, analysis: { turn: " " } }),
            ),
        ).toEqual(EMPTY_FLOW)
    })
})

describe("lead flow mapping", () => {
    it("maps every field, normalizes timestamps, and drops malformed touches and answers", async () => {
        const subject = await build()

        const answer = { i: 1, question: "What do you need?", answer: "Tea", at: NOW }
        expect(
            subject.toLeadFlow(
                rowOf({
                    platform: "instagram",
                    state: "scored",
                    resume_state: "qualifying",
                    source: SOURCE,
                    touches: [SOURCE, {}, null],
                    answers: [answer, { i: 2, question: 5, answer: null }, { i: "3" }, null],
                    asked: 2,
                    pending_question: 2,
                    contact_asked_at: new Date(NOW),
                    signals: { ...SIGNALS, need: "  Tea  ", interest: "high" },
                    score: "hot",
                    score_reasons: [" need ", 1, null],
                    scored_at: NOW,
                    analysis: { ...ANALYSIS, turn: " turn-1 " },
                    last_user_at: new Date(NOW),
                    last_user_text: "I'd like tea",
                    greeted_at: NOW,
                    handed_off_at: new Date(NOW),
                    followed_up_at: NOW,
                    closed_at: new Date(NOW),
                    escalated_at: NOW,
                    escalation_reason: "complaint",
                }),
            ),
        ).toEqual({
            ...EMPTY_FLOW,
            platform: "instagram",
            state: "scored",
            resume_state: "qualifying",
            source: SOURCE,
            touches: [SOURCE],
            answers: [answer, { i: 2, question: "", answer: "", at: "" }],
            asked: 2,
            pending_question: 2,
            contact_asked_at: NOW,
            signals: { ...SIGNALS, need: "Tea", interest: "high" },
            score: "hot",
            score_reasons: ["need", "", ""],
            scored_at: NOW,
            analysis: ANALYSIS,
            last_user_at: NOW,
            last_user_text: "I'd like tea",
            greeted_at: NOW,
            handed_off_at: NOW,
            followed_up_at: NOW,
            closed_at: NOW,
            escalated_at: NOW,
            escalation_reason: "complaint",
        })
    })
})

describe("lead flow mapping", () => {
    it.each<FlowState>(["new", "greeted", "qualifying", "scored", "handed_off", "nurturing", "closed", "escalated"])(
        "recognizes the stored state %s",
        async (state) => {
            const subject = await build()

            expect(subject.toLeadFlow(rowOf({ state, resume_state: state }))).toEqual({
                ...EMPTY_FLOW,
                state,
                resume_state: state,
            })
        },
    )
})

describe("lead flow mapping", () => {
    it.each(["hot", "warm", "cold", "unknown"])("recognizes the stored score %s", async (score) => {
        const subject = await build()

        expect(subject.toLeadFlow(rowOf({ score, platform: "facebook" }))).toEqual({
            ...EMPTY_FLOW,
            platform: "facebook",
            score: score === "unknown" ? null : score,
        })
    })
    it("serializes absent JSON fields and places each save parameter in column order", async () => {
        const subject = await build()

        expect(subject.saveParams(EMPTY_FLOW)).toEqual([
            "flow-1",
            "ws-1",
            "lead-1",
            "connection-1",
            "conversation-1",
            null,
            "person-1",
            null,
            "84912345678",
            "lan@example.com",
            "Lan",
            "new",
            null,
            "{}",
            "[]",
            "[]",
            0,
            null,
            null,
            JSON.stringify(SIGNALS),
            null,
            "[]",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
        ])
    })
})

describe("lead flow mapping", () => {
    it("serializes source, touches, answers, signals, reasons and analysis, preserving scalars", async () => {
        const subject = await build()

        const answer = { i: 0, question: "Need?", answer: "Tea", at: NOW }
        expect(
            subject.saveParams({
                ...EMPTY_FLOW,
                platform: "instagram",
                igsid: "ig-1",
                state: "escalated",
                resume_state: "scored",
                source: SOURCE,
                touches: [SOURCE],
                answers: [answer],
                asked: 1,
                pending_question: 0,
                contact_asked_at: NOW,
                score: "warm",
                score_reasons: ["need"],
                scored_at: NOW,
                analysis: ANALYSIS,
                last_user_at: NOW,
                last_user_text: "Tea please",
                greeted_at: NOW,
                handed_off_at: NOW,
                followed_up_at: NOW,
                closed_at: NOW,
                escalated_at: NOW,
                escalation_reason: "refund",
            }),
        ).toEqual([
            "flow-1",
            "ws-1",
            "lead-1",
            "connection-1",
            "conversation-1",
            "instagram",
            "person-1",
            "ig-1",
            "84912345678",
            "lan@example.com",
            "Lan",
            "escalated",
            "scored",
            JSON.stringify(SOURCE),
            JSON.stringify([SOURCE]),
            JSON.stringify([answer]),
            1,
            0,
            NOW,
            JSON.stringify(SIGNALS),
            "warm",
            '["need"]',
            NOW,
            JSON.stringify(ANALYSIS),
            NOW,
            "Tea please",
            NOW,
            NOW,
            NOW,
            NOW,
            NOW,
            "refund",
        ])
    })
})

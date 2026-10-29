import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import {
    platformOf as realPlatformOf,
    sourceKindOf as realSourceKindOf,
    leadSourceOf as realLeadSourceOf,
    toLeadFlow as realToLeadFlow,
    saveValues as realSaveValues,
} from "./lead-flow.mapper"
import type { Analysis, FlowState, LeadFlow, LeadSource, Signals, SourceKind } from "./lead-flows.contracts"
import type { LeadFlowEntity } from "./persistence/entities"

const SUBJECT = Symbol("lead-flow.mapper")

type Subject = Pick<
    typeof import("./lead-flow.mapper"),
    "platformOf" | "sourceKindOf" | "leadSourceOf" | "toLeadFlow" | "saveValues"
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
                    saveValues: realSaveValues,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = "2026-10-12T10:00:00.000Z"

const rowOf = builder<LeadFlowEntity>({
    id: "flow-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    connectionId: "connection-1",
    conversationId: "conversation-1",
    platform: null,
    psid: "person-1",
    igsid: null,
    phone: "84912345678",
    email: "lan@example.com",
    name: "Lan",
    state: "invalid",
    resumeState: null,
    source: null,
    touches: null,
    answers: null,
    asked: 0,
    pendingQuestion: null,
    contactAskedAt: null,
    signals: null,
    score: null,
    scoreReasons: null,
    scoredAt: null,
    analysis: null,
    lastUserAt: null,
    lastUserText: null,
    greetedAt: null,
    handedOffAt: null,
    followedUpAt: null,
    closedAt: null,
    escalatedAt: null,
    escalationReason: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    installationId: null,
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
                rowOf({ touches: {}, answers: "bad", scoreReasons: 1, signals: {}, analysis: { turn: " " } }),
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
                    resumeState: "qualifying",
                    source: SOURCE,
                    touches: [SOURCE, {}, null],
                    answers: [answer, { i: 2, question: 5, answer: null }, { i: "3" }, null],
                    asked: 2,
                    pendingQuestion: 2,
                    contactAskedAt: new Date(NOW),
                    signals: { ...SIGNALS, need: "  Tea  ", interest: "high" },
                    score: "hot",
                    scoreReasons: [" need ", 1, null],
                    scoredAt: new Date(NOW),
                    analysis: { ...ANALYSIS, turn: " turn-1 " },
                    lastUserAt: new Date(NOW),
                    lastUserText: "I'd like tea",
                    greetedAt: new Date(NOW),
                    handedOffAt: new Date(NOW),
                    followedUpAt: new Date(NOW),
                    closedAt: new Date(NOW),
                    escalatedAt: new Date(NOW),
                    escalationReason: "complaint",
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

            expect(subject.toLeadFlow(rowOf({ state, resumeState: state }))).toEqual({
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
    it("writes absent JSON fields as empty values and maps each mutable column", async () => {
        const subject = await build()

        expect(subject.saveValues(EMPTY_FLOW)).toEqual({
            leadId: "lead-1",
            connectionId: "connection-1",
            conversationId: "conversation-1",
            platform: null,
            psid: "person-1",
            igsid: null,
            phone: "84912345678",
            email: "lan@example.com",
            name: "Lan",
            state: "new",
            resumeState: null,
            source: {},
            touches: [],
            answers: [],
            asked: 0,
            pendingQuestion: null,
            contactAskedAt: null,
            signals: SIGNALS,
            score: null,
            scoreReasons: [],
            scoredAt: null,
            analysis: null,
            lastUserAt: null,
            lastUserText: null,
            greetedAt: null,
            handedOffAt: null,
            followedUpAt: null,
            closedAt: null,
            escalatedAt: null,
            escalationReason: null,
        })
    })
})

describe("lead flow mapping", () => {
    it("carries source, touches, answers, signals, reasons and analysis, and turns timestamps into dates", async () => {
        const subject = await build()

        const answer = { i: 0, question: "Need?", answer: "Tea", at: NOW }
        const at = new Date(NOW)
        expect(
            subject.saveValues({
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
        ).toEqual({
            leadId: "lead-1",
            connectionId: "connection-1",
            conversationId: "conversation-1",
            platform: "instagram",
            psid: "person-1",
            igsid: "ig-1",
            phone: "84912345678",
            email: "lan@example.com",
            name: "Lan",
            state: "escalated",
            resumeState: "scored",
            source: SOURCE,
            touches: [SOURCE],
            answers: [answer],
            asked: 1,
            pendingQuestion: 0,
            contactAskedAt: at,
            signals: SIGNALS,
            score: "warm",
            scoreReasons: ["need"],
            scoredAt: at,
            analysis: ANALYSIS,
            lastUserAt: at,
            lastUserText: "Tea please",
            greetedAt: at,
            handedOffAt: at,
            followedUpAt: at,
            closedAt: at,
            escalatedAt: at,
            escalationReason: "refund",
        })
    })
})

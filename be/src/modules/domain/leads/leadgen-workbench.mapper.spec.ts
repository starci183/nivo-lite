import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Proposal } from "@modules/domain/decisions"
import { buildLeadGenWorkbench, conversionSinceIso } from "./leadgen-workbench.mapper"
import type { LeadGenLeadRecord, LeadGenWorkbenchInput, LeadGenWorkItemRecord } from "./leadgen-workbench.contracts"

const SUBJECT = Symbol("leadgen-workbench.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { conversionSinceIso, buildLeadGenWorkbench } }],
    }).compile()
    return moduleRef.get<typeof import("./leadgen-workbench.mapper")>(SUBJECT)
}

const NOW = Date.parse("2026-10-12T03:00:00.000Z")
const CREATED = "2026-10-12T02:00:00.000Z"
const lead = (id: string, patch: Partial<LeadGenLeadRecord> = {}): LeadGenLeadRecord => ({
    id,
    contact_name: id,
    company: "Acme",
    channel: "facebook",
    need: "  Need\n advice  ",
    stage: "new",
    installation_id: "agent-1",
    created_at: CREATED,
    ...patch,
})
const item = (
    id: string,
    action: string,
    leadId: string | null,
    patch: Partial<LeadGenWorkItemRecord> = {},
): LeadGenWorkItemRecord => ({
    id,
    department: "lead_gen",
    action,
    lead_id: leadId,
    installation_id: "agent-1",
    status: "done",
    proposal: { summary: "Summary", fields: {} },
    created_at: CREATED,
    completed_at: null,
    ...patch,
})
const rows = (patch: Partial<LeadGenWorkbenchInput> = {}): LeadGenWorkbenchInput => ({
    nowMs: NOW,
    installationId: null,
    leads: [],
    items: [],
    conversations: [],
    messages: [],
    isTestRun: (name) => name === "UAT",
    ...patch,
})
const FACEBOOK = { platform: "facebook", kind: "other", refKind: null, refId: null, refLabel: null }
const POST = { platform: "facebook", kind: "comment", refKind: "post", refId: "post-1", refLabel: "Offer" }

const detailedWorkbenchRows = rows({
    leads: [
        lead("a"),
        lead("b", { stage: "won" }),
        lead("c", { stage: "proposal", channel: "other" }),
        lead("d", { stage: "qualified", channel: "other" }),
        lead("e", { channel: "other" }),
        lead("f", { stage: "won", created_at: "2026-07-14T02:59:59.999Z" }),
        lead("ignored", { channel: "other" }),
        lead("test", { contact_name: "UAT" }),
    ],
    items: [
        item("capture-a", "capture_lead", "a", {
            proposal: {
                summary: "Capture",
                fields: { score: "hot", source_kind: "comment", post_id: "post-1", source_label: "Offer" },
            },
        }),
        item("capture-a-old", "capture_lead", "a", {
            proposal: { summary: "Old", fields: { score: "cold" } },
        }),
        item("capture-b", "capture_lead", "b", {
            proposal: {
                summary: "Capture",
                fields: { score: "warm", source_kind: "comment", post_id: "post-1" },
            },
        }),
        item("capture-c", "capture_lead", "c", {
            proposal: { summary: "Capture", fields: { score: "cold" } },
        }),
        item("score-c", "score_lead", "c", { proposal: { summary: "Score", fields: { score: "hot" } } }),
        item("score-a", "score_lead", "a"),
        item("score-d", "score_lead", "d", { proposal: { summary: "Score", fields: { score: "warm" } } }),
        item("handoff-a", "handoff_to_sales", "a", { completed_at: "2026-10-12T02:30:00.000Z" }),
        item("handoff-e", "handoff_to_sales", "e"),
        item("handoff-missing", "handoff_to_sales", "missing"),
        item("without-lead", "capture_lead", null),
        item("classify-a", "classify_lead", "a", { department: "sales" }),
        item("classify-a-old", "classify_lead", "a", { department: "sales", status: "failed" }),
    ],
    conversations: [{ id: "talk-a", lead_id: "a" }],
    messages: [
        {
            conversation_id: "talk-a",
            role: "user",
            body: "Question",
            created_at: "2026-10-12T02:40:00.000Z",
        },
        {
            conversation_id: "talk-a",
            role: "agent",
            body: "  Latest\n reply  ",
            created_at: "2026-10-12T02:41:14.000Z",
        },
    ],
})

const expectedWorkbenchLeads = [
    {
        id: "a",
        name: "a",
        stage: "new",
        score: "hot",
        origin: POST,
        lastText: "Latest reply",
        lastAt: "2026-10-12T02:41:14.000Z",
        createdAt: CREATED,
        href: "/leads/a",
    },
    {
        id: "b",
        name: "b",
        stage: "won",
        score: "warm",
        origin: { ...POST, refLabel: null },
        lastText: "Need advice",
        lastAt: CREATED,
        createdAt: CREATED,
        href: "/leads/b",
    },
    {
        id: "c",
        name: "c",
        stage: "proposal",
        score: "hot",
        origin: { ...FACEBOOK, platform: "other" },
        lastText: "Need advice",
        lastAt: CREATED,
        createdAt: CREATED,
        href: "/leads/c",
    },
    {
        id: "d",
        name: "d",
        stage: "qualified",
        score: "warm",
        origin: { ...FACEBOOK, platform: "other" },
        lastText: "Need advice",
        lastAt: CREATED,
        createdAt: CREATED,
        href: "/leads/d",
    },
    {
        id: "e",
        name: "e",
        stage: "new",
        score: null,
        origin: { ...FACEBOOK, platform: "other" },
        lastText: "Need advice",
        lastAt: CREATED,
        createdAt: CREATED,
        href: "/leads/e",
    },
    {
        id: "f",
        name: "f",
        stage: "won",
        score: null,
        origin: FACEBOOK,
        lastText: "Need advice",
        lastAt: "2026-07-14T02:59:59.999Z",
        createdAt: "2026-07-14T02:59:59.999Z",
        href: "/leads/f",
    },
]

describe("leadgen-workbench.mapper", () => {
    it("reports the exact conversion boundary and an empty workbench", async () => {
        const subject = await buildSubject()

        expect(subject.conversionSinceIso(NOW)).toBe("2026-07-14T03:00:00.000Z")
        expect(subject.buildLeadGenWorkbench(rows())).toEqual({
            metrics: {
                newToday: 0,
                hotWaiting: 0,
                firstReplyP50Min: null,
                firstReplySample: 0,
                conversionWindowDays: 90,
                conversionLeads: 0,
                conversionWon: 0,
            },
            leads: [],
            leadsHidden: 0,
            sources: [],
            comments: [],
            handoffs: [],
        })
    })

    it("derives scores, source outcomes, latest activity and Sales handoffs from the newest work", async () => {
        const subject = await buildSubject()

        const result = subject.buildLeadGenWorkbench(detailedWorkbenchRows)
        expect(result.metrics).toEqual({
            newToday: 5,
            hotWaiting: 1,
            firstReplyP50Min: 1.2,
            firstReplySample: 1,
            conversionWindowDays: 90,
            conversionLeads: 5,
            conversionWon: 1,
        })
        expect(result.leads).toEqual(expectedWorkbenchLeads)
        expect(result.sources).toEqual([
            { key: "other:other::", origin: { ...FACEBOOK, platform: "other" }, leads: 3, hot: 1, won: 0 },
            { key: "facebook:comment:post:post-1", origin: POST, leads: 2, hot: 1, won: 1 },
            { key: "facebook:other::", origin: FACEBOOK, leads: 1, hot: 0, won: 1 },
        ])
        expect(result.handoffs).toEqual([
            {
                key: "handoff-a",
                leadId: "a",
                name: "a",
                score: "hot",
                at: "2026-10-12T02:30:00.000Z",
                classify: "done",
                stage: "new",
                href: "/leads/a",
            },
            {
                key: "handoff-e",
                leadId: "e",
                name: "e",
                score: null,
                at: CREATED,
                classify: null,
                stage: "new",
                href: "/leads/e",
            },
        ])
        expect(result.comments).toEqual([])
        expect(result.leadsHidden).toBe(0)
    })
})

describe("leadgen-workbench.mapper", () => {
    it("limits leads and pending comments to the selected installation while reading Sales classification", async () => {
        const subject = await buildSubject()

        const result = subject.buildLeadGenWorkbench(
            rows({
                installationId: "agent-1",
                leads: [lead("own"), lead("other", { installation_id: "agent-2" })],
                items: [
                    item("capture-own", "capture_lead", "own", {
                        proposal: { summary: "Capture", fields: { score: "hot" } },
                    }),
                    item("handoff-own", "handoff_to_sales", "own"),
                    item("classify-own", "classify_lead", "own", {
                        department: "sales",
                        installation_id: "sales-agent",
                        status: "waiting_decision",
                    }),
                    item("capture-other", "capture_lead", "other", { installation_id: "agent-2" }),
                    item("other-comment", "reply_comment_public", null, {
                        installation_id: "agent-2",
                        status: "waiting_decision",
                    }),
                    item("sales-comment", "reply_comment_public", null, {
                        department: "sales",
                        status: "waiting_decision",
                    }),
                    item("done-comment", "reply_comment_public", null),
                ],
            }),
        )
        expect(result.leads.map((row) => row.id)).toEqual(["own"])
        expect(result.handoffs).toEqual([
            {
                key: "handoff-own",
                leadId: "own",
                name: "own",
                score: "hot",
                at: CREATED,
                classify: "waiting_decision",
                stage: "new",
                href: "/leads/own",
            },
        ])
        expect(result.metrics.hotWaiting).toBe(1)
        expect(result.comments).toEqual([])
    })
})

/** A proposal stored by an older writer: its members are present and empty. */
const legacyProposal = Object.assign(mock<Proposal>(), { fields: undefined, summary: undefined, draft: undefined })
const missingProposal = Object.assign(
    mock<LeadGenWorkItemRecord>(item("missing", "reply_comment_public", null, { status: "waiting_decision" })),
    { proposal: undefined },
)

describe("leadgen-workbench.mapper", () => {
    it("reads pending comments defensively and orders them oldest first", async () => {
        const subject = await buildSubject()

        const result = subject.buildLeadGenWorkbench(
            rows({
                items: [
                    item("full", "reply_comment_public", null, {
                        status: "waiting_decision",
                        proposal: {
                            summary: "Unused",
                            draft: "Reply",
                            fields: {
                                platform: "instagram",
                                author_name: " An ",
                                comment_text: " Price? ",
                                post_id: "post-2",
                                source_label: "Launch",
                            },
                        },
                    }),
                    item("summary", "reply_comment_public", null, {
                        status: "waiting_decision",
                        created_at: "2026-10-12T01:00:00.000Z",
                        proposal: { summary: "Original comment", fields: { post_id: "post-3" } },
                    }),
                    item("legacy", "reply_comment_public", null, {
                        status: "waiting_decision",
                        created_at: "2026-10-12T00:00:00.000Z",
                        proposal: legacyProposal,
                    }),
                    missingProposal,
                ],
            }),
        )
        expect(result.comments).toEqual([
            {
                workItemId: "legacy",
                platform: "other",
                author: "",
                comment: "",
                draft: "",
                refLabel: null,
                at: "2026-10-12T00:00:00.000Z",
            },
            {
                workItemId: "summary",
                platform: "other",
                author: "",
                comment: "Original comment",
                draft: "",
                refLabel: "post-3",
                at: "2026-10-12T01:00:00.000Z",
            },
            {
                workItemId: "full",
                platform: "instagram",
                author: "An",
                comment: "Price?",
                draft: "Reply",
                refLabel: "Launch",
                at: CREATED,
            },
            {
                workItemId: "missing",
                platform: "other",
                author: "",
                comment: "",
                draft: "",
                refLabel: null,
                at: CREATED,
            },
        ])
    })
})

describe("leadgen-workbench.mapper", () => {
    it("orders equally sized sources by hot leads, counts closed hot leads, and caps only the visible list", async () => {
        const subject = await buildSubject()

        const leads = Array.from({ length: 102 }, (_, index) =>
            lead(`lead-${index}`, {
                channel: index < 51 ? "instagram" : "facebook",
                stage: index === 0 ? "lost" : "new",
            }),
        )
        const result = subject.buildLeadGenWorkbench(
            rows({
                leads,
                items: [
                    item("score", "score_lead", "lead-51", { proposal: { summary: "Hot", fields: { score: "hot" } } }),
                    item("second-score", "score_lead", "lead-52", {
                        proposal: { summary: "Hot", fields: { score: "hot" } },
                    }),
                    item("closed-score", "score_lead", "lead-0", {
                        proposal: { summary: "Hot", fields: { score: "hot" } },
                    }),
                ],
            }),
        )
        expect(result.leads.map((row) => row.id)).toEqual(Array.from({ length: 100 }, (_, index) => `lead-${index}`))
        expect(result.leadsHidden).toBe(2)
        expect(result.sources).toEqual([
            { key: "facebook:other::", origin: FACEBOOK, leads: 51, hot: 2, won: 0 },
            { key: "instagram:other::", origin: { ...FACEBOOK, platform: "instagram" }, leads: 51, hot: 1, won: 0 },
        ])
        expect(result.metrics).toEqual({
            newToday: 102,
            hotWaiting: 2,
            firstReplyP50Min: null,
            firstReplySample: 0,
            conversionWindowDays: 90,
            conversionLeads: 102,
            conversionWon: 0,
        })
    })
})

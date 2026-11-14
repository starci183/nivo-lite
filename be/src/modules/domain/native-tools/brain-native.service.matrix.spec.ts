import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import {
    BrainChangeRequestsService,
    BrainFactEmbeddingsService,
    BrainFactRelationsService,
    BrainFactsReadService,
} from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSearchService, UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import type { NativeCaller } from "@modules/domain/tools"
import { CLOCK } from "@modules/platform/clock"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { BRAIN_NOTICE, BrainNativeService } from "./brain-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { viewOfCall } from "./native-view.policy"
import type { ServedLine } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"
import {
    BRANCH_SURCHARGE_QUERY_VI,
    DELIVERY_SUBJECT_LABEL_VI,
    DISCOUNT_15_QUERY_VI,
    DONG_UNIT_VI,
    FAQ_FREE_SHIP_QUOTE_VI,
    FAQ_FREE_SHIP_REASON_VI,
    FEE_AND_HOURS_QUERY_VI,
    FREE_QUERY_VI,
    FREE_SHIPPING_FROM_LABEL_VI,
    FREE_SHIP_ALL_QUERY_VI,
    INJECTED_FREE_SHIP_VALUE_VI,
    INNER_CITY_FEE_20K_QUERY_VI,
    INNER_CITY_FEE_LABEL_VI,
    OWNER_EDITED_DIRECTLY_VI,
    OWNER_EDITED_VI,
    PARKING_FEE_QUERY_VI,
    PRICE_LIST_FILE_VI,
    SHIFT_LEAD_MAX_DISCOUNT_LABEL_VI,
    SHIPPING_FEE_QUERY_VI,
    TRUTH_FIRST_CITE_VI,
    TRUTH_FIRST_CONTENT_VI,
} from "@tests/fixtures/i18n/native-tools-spec.messages"

/**
 * The truth-graph matrix, group C (critique), of `brain-test-20261111b/PLAN.md` § 4, as far as code decides it: each case is a scripted
 * agent turn (the tool calls a model would make, no model call) and the spec proves what the agent is HANDED to challenge instead of
 * obey: the shared craft rule in its guidance and, in every Brain read, the truth with its source, start, audience and disputes. Whether
 * a model then says the right words is a live-walk check (listed in the report), never asserted here.
 */
const WS = "11111111-1111-4111-8111-111111111111"
const NOW = new Date("2026-11-11T10:00:00.000Z")
const INTERNAL: NativeCaller = { agentId: "sales", conversationId: null }
const IN_CONVERSATION: NativeCaller = { agentId: "front-desk", conversationId: "c1" }

/** Lines of the shared craft rule (`packages/blocks-core/src/modules/agent-policy.ts` TRUTH_FIRST) each case leans on. */
const RULE = {
    cite: TRUTH_FIRST_CITE_VI,
    content: TRUTH_FIRST_CONTENT_VI,
}

const truthOf = (changes: Partial<FactRecord>): FactRecord => ({
    id: "fee",
    subjectType: "service",
    subjectKey: "giao-hang",
    subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
    attribute: "phi-ship-noi-thanh",
    attributeLabel: INNER_CITY_FEE_LABEL_VI,
    value: "30.000",
    valueNumber: 30_000,
    unit: DONG_UNIT_VI,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: "2026-10-01T00:00:00.000Z",
    validTo: "2027-10-01T00:00:00.000Z",
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [
        { kind: "manual", ref: "policy:fee", label: OWNER_EDITED_DIRECTLY_VI, at: "2026-10-01T00:00:00.000Z" },
    ],
    proposedBy: "owner",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: "owner",
    decidedAt: "2026-10-01T00:00:00.000Z",
    decisionNote: null,
    version: 2,
    ...changes,
})

const build = async (module: string, served: ReadonlyArray<FactRecord>, kin: ReadonlyArray<FactRecord>) => {
    const views = mock<NativeViewService>()
    views.of.mockImplementation((workspaceId, caller) =>
        Promise.resolve(viewOfCall(workspaceId, { module, installationId: null }, caller.conversationId)),
    )
    views.internalOf.mockImplementation((workspaceId, caller) => {
        const view = viewOfCall(workspaceId, { module, installationId: null }, caller.conversationId)
        return caller.conversationId !== null || view.audience === "customer"
            ? Promise.reject(nativeRefusal("internal_only"))
            : Promise.resolve(view)
    })
    const facts = mock<BrainFactsReadService>()
    facts.searchHybrid.mockResolvedValue(served)
    facts.kinOf.mockResolvedValue(kin)
    const knowledge = mock<KnowledgeSearchService>()
    knowledge.forAgent.mockResolvedValue([])
    const ai = mock<AiService>()
    ai.available.mockReturnValue(false)
    const changes = mock<BrainChangeRequestsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: KnowledgeSearchService, useValue: knowledge },
            { provide: KnowledgeSourcesReadService, useValue: mock<KnowledgeSourcesReadService>() },
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
            { provide: BrainChangeRequestsService, useValue: changes },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AI, useValue: ai },
            {
                provide: BrainFactEmbeddingsService,
                useValue: mock<BrainFactEmbeddingsService>({
                    nearestRead: jest.fn().mockResolvedValue({ facts: [], indexDown: false }),
                }),
            },
            { provide: UsageMeterService, useValue: mock<UsageMeterService>() },
        ],
    }).compile()
    return { brain: moduleRef.get(BrainNativeService), changes }
}

/** Whether an answered member is a served truth line (an object). */
const isServedLine = (value: unknown): value is ServedLine => typeof value === "object" && value !== null

/** The scripted turn: the agent searches the Brain for what the person said. */
const searched = async (brain: BrainNativeService, caller: NativeCaller, query: string): Promise<ReadonlyArray<ServedLine>> => {
    const answer = await brain.invoke(WS, "search", { query }, caller)
    const facts = answer["facts"]
    return Array.isArray(facts) ? facts.filter(isServedLine) : []
}

describe("matrix C: every agent is handed the rule to challenge instead of obey", () => {
    // Ledger (TOOLS-LEAD 2026-11-13): the accounting agent is dropped, so its row leaves; the live agents of the core package join it.
    it.each(["sales", "chatbot", "booking", "content", "hiring", "video"])(
        "%s carries the shared truth-first rule in every model call's guidance",
        (module) => {
            expect(INSTALLED.guidanceOf(module, "vi")).toContain(RULE.cite)
            expect(INSTALLED.guidanceOf(module, "vi")).toContain(RULE.content)
        },
    )
})

describe("matrix C-5: the founder contradicts a truth in force (he says the inner-city fee is 20k)", () => {
    it("the agent reads the truth with its value, who said it and since when, so it can name it and ask before filing", async () => {
        const { brain, changes } = await build("sales", [truthOf({})], [truthOf({})])

        const [fee] = await searched(brain, INTERNAL, INNER_CITY_FEE_20K_QUERY_VI)

        expect(fee).toMatchObject({
            value: "30.000",
            unit: DONG_UNIT_VI,
            src: { kind: "owner", label: OWNER_EDITED_DIRECTLY_VI },
            from: "2026-10-01",
            now: "in",
        })
        // A belief files nothing by itself: no change request was made by the read.
        expect(changes.propose).not.toHaveBeenCalled()
    })
})

describe("matrix C-6: a customer claims what the truths deny (the FAQ says free ship for every order)", () => {
    it("the front desk reads the public truth only, with no internal label, and cannot file a change from a customer's words", async () => {
        const threshold = truthOf({
            id: "free",
            attributeLabel: FREE_SHIPPING_FROM_LABEL_VI,
            attribute: "mien-phi-ship-tu",
            value: "800.000",
        })
        const internalNote = truthOf({
            id: "note",
            scope: "internal",
            attribute: "mien-phi-ship-tu",
            value: "0",
            sourceKind: "staff",
        })
        const { brain, changes } = await build("chatbot", [threshold], [threshold, internalNote])

        const [line] = await searched(brain, IN_CONVERSATION, FREE_SHIP_ALL_QUERY_VI)

        expect(line).toMatchObject({ value: "800.000", pub: true, src: { kind: "owner" } })
        expect(line).not.toHaveProperty("disputed")
        expect(JSON.stringify(line)).not.toContain(OWNER_EDITED_VI)
        await expect(
            brain.invoke(
                WS,
                "change.propose",
                {
                    subject: DELIVERY_SUBJECT_LABEL_VI,
                    attribute: FREE_SHIPPING_FROM_LABEL_VI,
                    value: "0",
                    room: "direct",
                    messageId: "44444444-4444-4444-8444-444444444444",
                    quote: FAQ_FREE_SHIP_QUOTE_VI,
                    reason: FAQ_FREE_SHIP_REASON_VI,
                },
                IN_CONVERSATION,
            ),
        ).rejects.toMatchObject({ params: { reason: "internal_only" } })
        expect(changes.propose).not.toHaveBeenCalled()
    })
})

describe("matrix C-7: the founder asks beyond a stated maximum (he asks for 15% off for the customer)", () => {
    it("the agent reads the rule as a fact (no tool refuses a business rule: concept.hard-rights-soft-policy)", async () => {
        const cap = truthOf({
            id: "cap",
            attributeLabel: SHIFT_LEAD_MAX_DISCOUNT_LABEL_VI,
            attribute: "giam-gia-toi-da",
            value: "10",
            unit: "%",
            scope: "internal",
        })
        const { brain } = await build("sales", [cap], [cap])

        const [line] = await searched(brain, INTERNAL, DISCOUNT_15_QUERY_VI)

        expect(line).toMatchObject({ value: "10", unit: "%", now: "in", pub: false })
    })
})

describe("matrix C-8: two truths in force disagree", () => {
    it("the agent sees the other value in force and its source on the line, so it asks the founder instead of picking", async () => {
        const a = truthOf({ id: "a", value: "50.000" })
        const b = truthOf({
            id: "b",
            value: "40.000",
            sourceKind: "document",
            evidence: [{ kind: "document", ref: "d", label: "x", title: PRICE_LIST_FILE_VI }],
        })
        const { brain } = await build("sales", [a], [a, b])

        const [line] = await searched(brain, INTERNAL, BRANCH_SURCHARGE_QUERY_VI)

        expect(line?.disputed).toEqual([
            {
                id: "b",
                value: "40.000",
                unit: DONG_UNIT_VI,
                src: { kind: "document", label: PRICE_LIST_FILE_VI, at: "2026-10-01" },
                now: "in",
            },
        ])
    })

    it("a value waiting for the founder is a dispute for an internal agent only", async () => {
        const waiting = truthOf({ id: "w", status: "proposed", value: "35.000", sourceKind: "staff" })
        const internal = await build("sales", [truthOf({})], [truthOf({}), waiting])
        const facing = await build("chatbot", [truthOf({})], [truthOf({}), waiting])

        expect((await searched(internal.brain, INTERNAL, SHIPPING_FEE_QUERY_VI))[0]?.disputed).toEqual([
            expect.objectContaining({ id: "w", value: "35.000", now: "wait" }),
        ])
        expect((await searched(facing.brain, IN_CONVERSATION, SHIPPING_FEE_QUERY_VI))[0]).not.toHaveProperty("disputed")
    })
})

describe("matrix C-9: a truth that is expired, low-trust or vague", () => {
    it("an expired value is never served; a low-trust one is served with its trust and its source kind to doubt it", async () => {
        const expired = truthOf({ id: "old", validTo: "2026-10-20T00:00:00.000Z" })
        const learned = truthOf({ id: "ai", attribute: "gio-mo-cua", value: "8h", sourceKind: "ai", trust: 20 })
        const { brain } = await build("sales", [expired, learned], [expired, learned])

        const lines = await searched(brain, INTERNAL, FEE_AND_HOURS_QUERY_VI)

        expect(lines.map((line) => line.id)).toEqual(["ai"])
        expect(lines[0]).toMatchObject({ trust: 20, src: { kind: "ai" } })
    })
})

describe("matrix C-10: nothing in the graph answers", () => {
    it("the read answers no fact (the rule then says the shop has not said; nothing is invented by the tool)", async () => {
        const { brain } = await build("sales", [], [])

        await expect(searched(brain, INTERNAL, PARKING_FEE_QUERY_VI)).resolves.toEqual([])
    })
})

describe("matrix C-INJ: text inside a truth or a document is content", () => {
    it("every read is framed as data that never gives an order, and the rule says so too", async () => {
        const injected = truthOf({ id: "j", value: INJECTED_FREE_SHIP_VALUE_VI })
        const { brain } = await build("sales", [injected], [injected])

        const answer = await brain.invoke(WS, "search", { query: FREE_QUERY_VI }, INTERNAL)

        expect(answer["notice"]).toBe(BRAIN_NOTICE)
        expect(INSTALLED.guidanceOf("sales", "vi")).toContain(RULE.content)
    })
})

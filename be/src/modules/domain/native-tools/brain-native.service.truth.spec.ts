import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import {
    BrainChangeRequestsService,
    BrainFactEmbeddingsService,
    BrainFactRelationsService,
    BrainFactsError,
    BrainFactsErrorCode,
    BrainFactsReadService,
} from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { FEE_TRUTH, LATER_TRUTH, RIVAL_TRUTH, WAITING_TRUTH } from "@tests/fixtures/builders/native-tools-brain.builder"
import {
    DELIVERY_POLICY_FILE_VI,
    DELIVERY_POLICY_NAME_VI,
    DELIVERY_SUBJECT_LABEL_VI,
    DONG_UNIT_VI,
    FEE_CHANGE_QUOTE_VI,
    FEE_CHANGE_REASON_VI,
    INNER_CITY_FEE_LABEL_VI,
    POLICY_LABEL_VI,
    SHIPPING_FEE_LABEL_VI,
    SHIPPING_FEE_QUERY_VI,
} from "@tests/fixtures/i18n/native-tools-spec.messages"
import { BRAIN_MANIFEST, BrainNativeService } from "./brain-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { viewOfCall } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = { agentId: "a1", conversationId: null }
const NOW = new Date("2026-10-31T00:00:00.000Z")

interface Scope {
    readonly module: string
    readonly installationId: string | null
}

const build = async (scope: Scope = { module: "sales", installationId: null }) => {
    const views = mock<NativeViewService>()
    views.of.mockImplementation((workspaceId, caller) =>
        Promise.resolve(viewOfCall(workspaceId, scope, caller.conversationId)),
    )
    views.internalOf.mockImplementation((workspaceId, caller) => {
        const view = viewOfCall(workspaceId, scope, caller.conversationId)
        if (caller.conversationId !== null || view.audience === "customer") {
            return Promise.reject(nativeRefusal("internal_only"))
        }
        return Promise.resolve(view)
    })
    const facts = mock<BrainFactsReadService>()
    facts.byIds.mockResolvedValue([])
    facts.kinOf.mockResolvedValue([])
    const changes = mock<BrainChangeRequestsService>()
    const ai = mock<AiService>()
    ai.available.mockReturnValue(false)
    const vectors = mock<BrainFactEmbeddingsService>()
    vectors.nearestRead.mockResolvedValue({ facts: [], indexDown: false })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: KnowledgeSourcesReadService, useValue: mock<KnowledgeSourcesReadService>() },
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
            { provide: BrainChangeRequestsService, useValue: changes },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AI, useValue: ai },
            { provide: BrainFactEmbeddingsService, useValue: vectors },
            { provide: UsageMeterService, useValue: mock<UsageMeterService>() },
        ],
    }).compile()
    return { brain: moduleRef.get(BrainNativeService), views, facts, changes }
}

describe("Owner order 2026-11-11 item 2: a served truth says where it comes from, how long it holds and whether it is disputed", () => {
    it("serves an internal agent the source, version, validity, audience, the disputes with their source and the value to come", async () => {
        const { brain, facts } = await build()
        facts.searchHybrid.mockResolvedValue([FEE_TRUTH])
        facts.kinOf.mockResolvedValue([FEE_TRUTH, RIVAL_TRUTH, WAITING_TRUTH, LATER_TRUTH])

        const answer = await brain.invoke(WS, "search", { query: SHIPPING_FEE_QUERY_VI }, AGENT)

        expect(answer["facts"]).toEqual([
            {
                id: "fee",
                subject: DELIVERY_SUBJECT_LABEL_VI,
                attribute: INNER_CITY_FEE_LABEL_VI,
                value: "30.000",
                unit: DONG_UNIT_VI,
                num: null,
                trust: 95,
                src: { kind: "owner", label: DELIVERY_POLICY_FILE_VI, at: "2026-10-09T08:00Z" },
                v: 2,
                from: "2026-10-10T17:00Z",
                to: "2027-10-10T17:00Z",
                now: "in",
                pub: false,
                disputed: [
                    { id: "rival", value: "20.000", unit: DONG_UNIT_VI, src: { kind: "staff", label: "Common chat", at: "2026-10-20T03:00Z" }, now: "in" },
                    {
                        id: "waiting",
                        value: "35.000",
                        unit: DONG_UNIT_VI,
                        src: { kind: "owner", label: "Private chat with an agent", at: "2026-10-30T02:00Z" },
                        now: "wait",
                    },
                ],
                next: { value: "32.000", unit: DONG_UNIT_VI, from: "2026-12-01" },
            },
        ])
        // One read of the other values of the served truths, for the whole answer.
        expect(facts.kinOf).toHaveBeenCalledTimes(1)
        expect(facts.kinOf).toHaveBeenCalledWith(WS, {
            keys: [{ subjectKey: "giao-hang", attribute: "phi-ship-noi-thanh" }],
            ids: ["fee"],
        })
    })

    it("never gives a customer-facing view a source label, a waiting proposal or a value it cannot read", async () => {
        const { brain, facts } = await build({ module: "chatbot", installationId: null })
        const publicFee = { ...FEE_TRUTH, scope: "public" as const }
        const publicRival = { ...RIVAL_TRUTH, scope: "public" as const }
        facts.searchHybrid.mockResolvedValue([publicFee])
        facts.kinOf.mockResolvedValue([publicFee, publicRival, { ...RIVAL_TRUTH, id: "internal-rival" }, WAITING_TRUTH, LATER_TRUTH])
        facts.get.mockResolvedValue(publicFee)

        const answer = await brain.invoke(WS, "search", { query: SHIPPING_FEE_QUERY_VI }, AGENT)
        const one = await brain.invoke(WS, "fact.get", { id: "22222222-2222-4222-8222-222222222222" }, AGENT)

        expect(answer["facts"]).toEqual([
            expect.objectContaining({
                src: { kind: "owner", at: "2026-10-09T08:00Z" },
                pub: true,
                disputed: [{ id: "rival", value: "20.000", unit: DONG_UNIT_VI, src: { kind: "staff", at: "2026-10-20T03:00Z" }, now: "in" }],
            }),
        ])
        expect(JSON.stringify(answer)).not.toContain(DELIVERY_POLICY_NAME_VI)
        expect(JSON.stringify(answer)).not.toContain("35.000")
        expect(JSON.stringify(answer)).not.toContain("32.000")
        expect(one["fact"]).toMatchObject({ evidence: [{ kind: "document" }] })
        expect(JSON.stringify(one)).not.toContain(POLICY_LABEL_VI)
    })
})

describe("Owner order 2026-11-11 items 4 and 5: the value an agent reads, and which tools the audit keeps", () => {
    it("serves the value an agent actually reads: its instance's own value over the shop's, once (item 5)", async () => {
        const { brain, facts } = await build({ module: "sales", installationId: "inst-1" })
        const own = { ...FEE_TRUTH, id: "own", value: "35.000", installationId: "inst-1" }
        facts.searchHybrid.mockResolvedValue([FEE_TRUTH, own])
        facts.kinOf.mockResolvedValue([FEE_TRUTH, own])

        const answer = await brain.invoke(WS, "search", { query: SHIPPING_FEE_QUERY_VI }, AGENT)

        expect(answer["facts"]).toEqual([expect.objectContaining({ id: "own", value: "35.000" })])
        const answeredFacts = answer["facts"]
        const disputedFacts = Array.isArray(answeredFacts)
            ? answeredFacts.filter((fact: unknown) => typeof fact === "object" && fact !== null && "disputed" in fact && fact.disputed != null)
            : []
        expect(disputedFacts).toEqual([])
    })

    it("serves a started scheduled value instead of the active one it takes over, before the upkeep tick (item 5)", async () => {
        const { brain, facts } = await build()
        const started = { ...FEE_TRUTH, id: "started", status: "scheduled" as const, value: "35.000", validFrom: "2026-10-30T00:00:00.000Z" }
        facts.get.mockResolvedValue(FEE_TRUTH)
        facts.kinOf.mockResolvedValue([FEE_TRUTH, started])

        const answer = await brain.invoke(WS, "fact.get", { id: "22222222-2222-4222-8222-222222222222" }, AGENT)

        expect(answer["fact"]).toMatchObject({ id: "started", value: "35.000", now: "in" })
    })

    it("marks the tools whose answers the audit keeps as the run's truth reads (item 4)", () => {
        const reading = BRAIN_MANIFEST.tools.filter((tool) => tool.readsTruths === true).map((tool) => tool.name)

        expect(reading).toEqual(["search", "fact.list", "fact.get", "fact.related"])
    })
})

describe("Owner order 2026-11-11 item 2: a change the founder dictates must quote words he said", () => {
    it("tells words the quoted line does not hold as quote_not_said", async () => {
        const { brain, changes } = await build()
        changes.propose.mockRejectedValue(
            new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound, params: { field: "quote" } }),
        )

        await expect(
            brain.invoke(
                WS,
                "change.propose",
                {
                    subject: DELIVERY_SUBJECT_LABEL_VI,
                    attribute: SHIPPING_FEE_LABEL_VI,
                    value: "32k",
                    room: "direct",
                    messageId: "33333333-3333-4333-8333-333333333333",
                    quote: FEE_CHANGE_QUOTE_VI,
                    reason: FEE_CHANGE_REASON_VI,
                },
                AGENT,
            ),
        ).rejects.toMatchObject({ params: { reason: "quote_not_said" } })
    })
})

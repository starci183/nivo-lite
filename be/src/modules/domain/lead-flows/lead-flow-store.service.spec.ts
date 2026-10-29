import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { saveValues, toLeadFlow } from "./lead-flow.mapper"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import type { Identity, LeadSource, NewLeadFlow } from "./lead-flows.contracts"
import { LeadFlowEntity } from "./persistence/entities"
import { NOW } from "./persistence/lead-flow-projection"

const rowOf = builder<LeadFlowEntity>({
    id: "flow-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    connectionId: "connection-1",
    conversationId: null,
    platform: "facebook",
    psid: "person-1",
    igsid: null,
    phone: null,
    email: null,
    name: "Lan",
    state: "new",
    resumeState: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pendingQuestion: null,
    contactAskedAt: null,
    signals: null,
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
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    updatedAt: new Date("2026-10-12T10:00:00.000Z"),
    installationId: null,
})

/** The RETURNING row of a write that answered this flow, as the database names its columns. */
const returned = (flow: LeadFlowEntity): QueryBuilderAnswers => ({
    execute: {
        raw: [
            Object.fromEntries(
                Object.entries(flow).map(([key, value]) => [
                    key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
                    value,
                ]),
            ),
        ],
    },
})

const NOBODY: Identity = { psid: null, igsid: null, phone: null, email: null }

const SOURCE: LeadSource = {
    platform: "facebook",
    kind: "dm",
    post_id: null,
    ad_id: null,
    form_id: null,
    comment_id: null,
    leadgen_id: null,
    referral: null,
    at: "2026-10-12T10:00:00.000Z",
}

const build = async (
    entityManager: MockEntityManager = mockEntityManager(),
    statements: ReadonlyArray<QueryBuilderAnswers> = [],
) => {
    const fakes = queueQueryBuilders(entityManager, statements)
    const moduleRef = await Test.createTestingModule({
        providers: [LeadFlowStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { store: moduleRef.get(LeadFlowStoreService), entityManager, fakes }
}

describe("LeadFlowStoreService", () => {
    it("reads the flow of a lead and refuses a lead without one", async () => {
        const { store, entityManager } = await build(
            mockEntityManager({
                findOne: [
                    [LeadFlowEntity, rowOf()],
                    [LeadFlowEntity, null],
                ],
            }),
        )

        await expect(store.requireByLead("ws-1", "lead-1")).resolves.toEqual(toLeadFlow(rowOf()))
        await expect(store.requireByLead("ws-1", "lead-2")).rejects.toMatchObject({ code: LeadFlowsErrorCode.NoFlow })

        expect(entityManager.findOne.mock.calls).toEqual([
            [LeadFlowEntity, { where: { workspaceId: "ws-1", leadId: "lead-1" } }],
            [LeadFlowEntity, { where: { workspaceId: "ws-1", leadId: "lead-2" } }],
        ])
    })
    it("answers no flow for a missing lead and no candidates for an empty identity without a query", async () => {
        const { store, entityManager } = await build()

        await expect(store.byLead("ws-1", null)).resolves.toBeNull()
        await expect(store.candidates("ws-1", NOBODY)).resolves.toEqual([])

        expect(entityManager.findOne).not.toHaveBeenCalled()
        expect(entityManager.find).not.toHaveBeenCalled()
    })
    it("finds the candidate flows by every identity key that is set, oldest first", async () => {
        const { store, entityManager } = await build(mockEntityManager({ find: [LeadFlowEntity, [rowOf()]] }))

        await expect(store.candidates("ws-1", { ...NOBODY, psid: "person-1" })).resolves.toEqual([toLeadFlow(rowOf())])
        await store.candidates("ws-1", { psid: "p", igsid: "i", phone: "0", email: "e@x" })

        expect(entityManager.find).toHaveBeenNthCalledWith(1, LeadFlowEntity, {
            where: [{ workspaceId: "ws-1", psid: "person-1" }],
            order: { createdAt: "ASC" },
            take: 20,
        })
        expect(entityManager.find).toHaveBeenNthCalledWith(2, LeadFlowEntity, {
            where: [
                { workspaceId: "ws-1", psid: "p" },
                { workspaceId: "ws-1", igsid: "i" },
                { workspaceId: "ws-1", phone: "0" },
                { workspaceId: "ws-1", email: "e@x" },
            ],
            order: { createdAt: "ASC" },
            take: 20,
        })
    })
})

describe("LeadFlowStoreService", () => {
    it("opens a flow, and answers null when the same person was opened at the same moment", async () => {
        const opening: NewLeadFlow = {
            workspaceId: "ws-1",
            leadId: "lead-1",
            connectionId: "connection-1",
            platform: "facebook",
            identity: { ...NOBODY, psid: "person-1" },
            name: "Lan",
            source: SOURCE,
            lastUserAt: SOURCE.at,
            lastUserText: "Hello",
        }
        const { store, fakes } = await build(mockEntityManager(), [returned(rowOf()), { execute: { raw: [] } }])

        await expect(store.open(opening)).resolves.toEqual(toLeadFlow(rowOf()))
        await expect(store.open(opening)).resolves.toBeNull()

        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    connectionId: "connection-1",
                    platform: "facebook",
                    psid: "person-1",
                    igsid: null,
                    phone: null,
                    email: null,
                    name: "Lan",
                    source: SOURCE,
                    touches: [SOURCE],
                    lastUserAt: new Date(SOURCE.at ?? ""),
                    lastUserText: "Hello",
                },
            ],
        ])
        expect(fakes[0]?.callsOf("orIgnore")).toHaveLength(1)
        expect(fakes[0]?.callsOf("returning")).toEqual([["*"]])
    })
    it("opens a flow of a person who has not written yet", async () => {
        const opening: NewLeadFlow = {
            workspaceId: "ws-1",
            leadId: "lead-1",
            connectionId: null,
            platform: "facebook",
            identity: NOBODY,
            name: null,
            source: SOURCE,
            lastUserAt: null,
            lastUserText: null,
        }
        const { store, fakes } = await build(mockEntityManager(), [returned(rowOf())])

        await store.open(opening)

        expect(fakes[0]?.callsOf("values")).toEqual([[expect.objectContaining({ lastUserAt: null })]])
    })
})

describe("LeadFlowStoreService", () => {
    it("saves a patched flow and refuses a save that returns no row", async () => {
        const flow = toLeadFlow(rowOf())
        const { store, fakes } = await build(mockEntityManager(), [
            returned(rowOf({ state: "greeted" })),
            { execute: { raw: [] } },
        ])

        await expect(store.patch(flow, { state: "greeted" })).resolves.toEqual(toLeadFlow(rowOf({ state: "greeted" })))
        await expect(store.patch(flow, { state: "closed" })).rejects.toMatchObject({
            code: LeadFlowsErrorCode.NotStored,
        })

        expect(fakes[0]?.callsOf("set")).toEqual([[{ ...saveValues({ ...flow, state: "greeted" }), updatedAt: NOW }]])
        expect(fakes[0]?.callsOf("where")).toEqual([[{ id: "flow-1", workspaceId: "ws-1" }]])
        expect(fakes[0]?.callsOf("returning")).toEqual([["*"]])
    })
})

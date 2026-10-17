import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { saveParams, toLeadFlow } from "./lead-flow.mapper"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import type { Identity, LeadSource, NewLeadFlow } from "./lead-flows.contracts"
import type { LeadFlowRow } from "./persistence/lead-flows.rows"
import { FIND_FLOW_BY_LEAD, FIND_FLOW_CANDIDATES, INSERT_FLOW, SAVE_FLOW } from "./persistence/lead-flows.sql"

const rowOf = builder<LeadFlowRow>({
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: null,
    platform: "facebook",
    psid: "person-1",
    igsid: null,
    phone: null,
    email: null,
    name: "Lan",
    state: "new",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: null,
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

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const entityManager = mockEntityManager({ query: stubs })
    const moduleRef = await Test.createTestingModule({
        providers: [LeadFlowStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { store: moduleRef.get(LeadFlowStoreService), entityManager }
}

describe("LeadFlowStoreService", () => {
    it("reads the flow of a lead and refuses a lead without one", async () => {
        const { store, entityManager } = await build([
            [FIND_FLOW_BY_LEAD, [rowOf()]],
            [FIND_FLOW_BY_LEAD, []],
        ])

        await expect(store.requireByLead("ws-1", "lead-1")).resolves.toEqual(toLeadFlow(rowOf()))
        await expect(store.requireByLead("ws-1", "lead-2")).rejects.toMatchObject({ code: LeadFlowsErrorCode.NoFlow })

        expect(entityManager.query.mock.calls).toEqual([
            [FIND_FLOW_BY_LEAD, ["ws-1", "lead-1"]],
            [FIND_FLOW_BY_LEAD, ["ws-1", "lead-2"]],
        ])
    })
    it("answers no flow for a missing lead and no candidates for an empty identity without a query", async () => {
        const { store, entityManager } = await build([])

        await expect(store.byLead("ws-1", null)).resolves.toBeNull()
        await expect(store.candidates("ws-1", NOBODY)).resolves.toEqual([])

        expect(entityManager.query).not.toHaveBeenCalled()
    })
    it("finds the candidate flows by every identity key", async () => {
        const { store, entityManager } = await build([[FIND_FLOW_CANDIDATES, [rowOf()]]])

        await expect(store.candidates("ws-1", { ...NOBODY, psid: "person-1" })).resolves.toEqual([toLeadFlow(rowOf())])

        expect(entityManager.query).toHaveBeenCalledWith(FIND_FLOW_CANDIDATES, ["ws-1", "person-1", null, null, null])
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
        const { store, entityManager } = await build([
            [INSERT_FLOW, [rowOf()]],
            [INSERT_FLOW, []],
        ])

        await expect(store.open(opening)).resolves.toEqual(toLeadFlow(rowOf()))
        await expect(store.open(opening)).resolves.toBeNull()

        expect(entityManager.query).toHaveBeenCalledWith(INSERT_FLOW, [
            "ws-1",
            "lead-1",
            "connection-1",
            "facebook",
            "person-1",
            null,
            null,
            null,
            "Lan",
            JSON.stringify(SOURCE),
            JSON.stringify([SOURCE]),
            SOURCE.at,
            "Hello",
        ])
    })
})

describe("LeadFlowStoreService", () => {
    it("saves a patched flow and refuses a save that returns no row", async () => {
        const flow = toLeadFlow(rowOf())
        const { store, entityManager } = await build([
            [SAVE_FLOW, [rowOf({ state: "greeted" })]],
            [SAVE_FLOW, []],
        ])

        await expect(store.patch(flow, { state: "greeted" })).resolves.toEqual(toLeadFlow(rowOf({ state: "greeted" })))
        await expect(store.patch(flow, { state: "closed" })).rejects.toMatchObject({
            code: LeadFlowsErrorCode.NotStored,
        })

        expect(entityManager.query).toHaveBeenNthCalledWith(1, SAVE_FLOW, saveParams({ ...flow, state: "greeted" }))
    })
})

import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { WorkEngineService } from "@modules/domain/decisions"
import { PublicLeadsService } from "@modules/domain/public-api"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest, publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof, DEFAULT_NEED } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiLead, apiInbound, apiEvents } from "../../world/public-api-database.service"

describe("Public API new-lead (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, requestForLead } = preparePublicApiProof(world)

    it("hands a new customer to chatbot with the default need and reuses the inbound on replay", async () => {
        const identity = await fixture()
        const externalId = world.id()
        await world.resolve(PublicLeadsService).acceptLead({
            authorization: identity.authorization,
            name: "New API customer",
            email: `${externalId}@example.test`,
            externalId,
            company: "New API company",
            stage: "qualified",
            note: "New customer note must survive the durable handoff",
        })
        const request = await requestForLead(identity.workspaceId, externalId)
        const payload = { workspaceId: identity.workspaceId, requestId: request.id }
        await deliver(payload)
        const inbound = await apiInbound(world.db.primary, identity.workspaceId)
        expect(inbound).toEqual([expect.objectContaining({ body: DEFAULT_NEED })])
        const [work] = await publicApiWork(world, identity.workspaceId)
        assert(work !== undefined)
        expect(work).toMatchObject({ action: "handoff_lead", status: "queued", inbound_event_id: inbound[0]?.id })
        expect(work.proposal.fields).toMatchObject({ need: DEFAULT_NEED })
        await deliver(payload)
        expect(await apiInbound(world.db.primary, identity.workspaceId)).toEqual(inbound)
        expect(await publicApiWork(world, identity.workspaceId)).toEqual([work])
        const completed = await world
            .resolve(WorkEngineService)
            .runQueuedItem({ workspaceId: identity.workspaceId, actor: "NIVO", locale: "en" }, work.id)
        expect(completed).toMatchObject({ status: "done" })
        assert(completed?.lead_id !== null && completed?.lead_id !== undefined)
        const lead = await apiLead(world.db.primary, identity.workspaceId, completed.lead_id)
        expect(lead).toEqual([
            expect.objectContaining({ need: DEFAULT_NEED, company: "New API company", stage: "qualified" }),
        ])
        expect((await publicApiRequest(world, identity.workspaceId, request.id)).lead_id).toBe(completed.lead_id)
        const evidence = await apiEvents(world.db.primary, identity.workspaceId)
        expect(evidence.filter((event) => event.kind === "api.note")).toEqual([
            expect.objectContaining({ evidence: "New customer note must survive the durable handoff" }),
        ])
        const settledWork = await publicApiWork(world, identity.workspaceId)
        await deliver(payload)
        expect(await publicApiWork(world, identity.workspaceId)).toEqual(settledWork)
    })
})

import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicLeadsService } from "@modules/domain/public-api"
import { persistPublicApiLead } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest, publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiLead } from "../../world/public-api-database.service"

describe("Public API won customer (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, requestForLead, outbox, dealsWon } = preparePublicApiProof(world)

    it("queues the invoice for the returned customer and publishes deal.won once across replay", async () => {
        const identity = await fixture()
        const leadId = world.id()
        const externalId = world.id()
        await persistPublicApiLead(world.db.primary, identity.workspaceId, leadId)
        await world.resolve(PublicLeadsService).acceptLead({
            authorization: identity.authorization,
            name: "Existing API customer",
            email: `${leadId}@example.test`,
            externalId,
            company: "Won API company",
            need: "Invoice annual service",
            stage: "won",
        })
        const request = await requestForLead(identity.workspaceId, externalId)
        const payload = { workspaceId: identity.workspaceId, requestId: request.id }
        await deliver(payload)
        expect(await apiLead(world.db.primary, identity.workspaceId, leadId)).toMatchObject([
            { id: leadId, stage: "won", company: "Won API company", need: "Invoice annual service" },
        ])
        const work = await publicApiWork(world, identity.workspaceId)
        const invoices = work.filter((item) => item.action === "issue_invoice")
        expect(invoices).toHaveLength(1)
        expect(invoices).toMatchObject([
            {
                status: "queued",
                subject_type: "lead",
                subject_id: leadId,
                lead_id: leadId,
                dedupe_key: `issue_invoice:lead:${leadId}`,
            },
        ])
        const publications = await outbox(identity.workspaceId)
        const won = await dealsWon(identity.workspaceId)
        expect(won).toHaveLength(1)
        expect(won[0]).toMatchObject({
            eventName: "deal_won",
            eventId: `deal.won:${leadId}`,
            payload: {
                dedupeKey: `deal.won:${leadId}`,
                workspaceId: identity.workspaceId,
                leadId,
                name: "Existing API customer",
                company: "Won API company",
                channel: "API",
                need: "Invoice annual service",
                source: "api:Public API proof",
            },
        })
        const completed = await publicApiRequest(world, identity.workspaceId, request.id)
        expect(completed.lead_id).toBe(leadId)
        expect(completed.processed_at).toBeInstanceOf(Date)
        await deliver(payload)
        expect(await publicApiWork(world, identity.workspaceId)).toEqual(work)
        expect(await outbox(identity.workspaceId)).toEqual(publications)
        expect(await dealsWon(identity.workspaceId)).toEqual(won)
        expect(await publicApiRequest(world, identity.workspaceId, request.id)).toEqual(completed)
    })
})

import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicLeadsService } from "@modules/domain/public-api"
import { persistPublicApiLead } from "../../fixtures/builders/public-api.builder"
import * as statements from "../../fixtures/persistence/public-api.sql"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest, publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API won customer (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, requestForLead, outbox } = preparePublicApiProof(world)

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
        expect(await world.db.primary.query(statements.API_LEAD, [identity.workspaceId, leadId])).toMatchObject([
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
        const won = publications.filter((item) => item.payload["event"] === "deal.won")
        expect(won).toHaveLength(1)
        const [event] = won
        assert(event !== undefined)
        expect(event.queue).toBe("automation")
        expect(event.name).toBe("automation.tick")
        expect(event.dedupe_key).toBe(`deal.won:${leadId}`)
        expect(event.payload).toEqual({
            kind: "business_event",
            event: "deal.won",
            workspaceId: identity.workspaceId,
            dedupe: `deal.won:${leadId}`,
            data: {
                lead_id: leadId,
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
        expect(await publicApiRequest(world, identity.workspaceId, request.id)).toEqual(completed)
    })
})

import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { WorkEngineService } from "@modules/domain/decisions"
import { persistPublicApiInbound } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiLead, apiInbound } from "../../world/public-api-database.service"

describe("Public API legacy-lead (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    it("reuses the recorded inbound identity of a historical inline customer handoff", async () => {
        const identity = await fixture()
        const inboundEventId = world.id()
        await persistPublicApiInbound(world.db.primary, {
            id: inboundEventId,
            workspaceId: identity.workspaceId,
            channel: "manual",
            kind: "lead",
            senderName: "Historical customer",
            body: "Historical service need",
            externalRef: "api:Public API proof",
            eventId: world.id(),
            dedupeKey: `api:historical:${world.id()}`,
        })
        const payload = {
            kind: "lead",
            workspaceId: identity.workspaceId,
            keyId: identity.keyId,
            keyName: "Public API proof",
            inboundEventId,
            company: "Historical company",
            channel: "Audited historical campaign",
            stage: "qualified",
            note: "Historical note",
        }
        await deliver(payload, "public_api")
        await deliver(payload, "public_api")
        expect(await apiInbound(world.db.primary, identity.workspaceId)).toEqual([
            expect.objectContaining({ id: inboundEventId, body: "Historical service need" }),
        ])
        const work = await publicApiWork(world, identity.workspaceId)
        expect(work).toEqual([expect.objectContaining({ action: "handoff_lead", inbound_event_id: inboundEventId })])
        const [handoff] = work
        assert(handoff !== undefined)
        const completed = await world
            .resolve(WorkEngineService)
            .runQueuedItem({ workspaceId: identity.workspaceId, actor: "NIVO", locale: "en" }, handoff.id)
        expect(completed).toMatchObject({ status: "done" })
        assert(completed?.lead_id !== null && completed?.lead_id !== undefined)
        expect(await apiLead(world.db.primary, identity.workspaceId, completed.lead_id)).toEqual([
            expect.objectContaining({
                need: "Historical service need",
                company: "Historical company",
                channel: "Audited historical campaign",
                stage: "qualified",
            }),
        ])
    })
})

import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { WorkEngineService } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { persistPublicApiInbound } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof, DEFAULT_NEED, RETAINED_NEED } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API linked-legacy-lead (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    it("retains a linked historical customer's actual channel when its original inline job omitted it", async () => {
        const identity = await fixture()
        const known = await world.resolve(LeadRecordsService).capture({
            workspaceId: identity.workspaceId,
            contactName: "Renamed existing customer",
            company: "Custom channel company",
            channel: "Partner referral",
            need: RETAINED_NEED,
            phone: null,
            email: null,
        })
        const inboundEventId = world.id()
        await persistPublicApiInbound(world.db.primary, {
            id: inboundEventId,
            workspace_id: identity.workspaceId,
            channel: "manual",
            kind: "lead",
            sender_name: "Original customer name",
            body: DEFAULT_NEED,
            external_ref: "api:Public API proof",
            event_id: world.id(),
            dedupe_key: `api:historical:${world.id()}`,
            lead_id: known.id,
        })
        const payload = {
            kind: "lead",
            workspaceId: identity.workspaceId,
            keyId: identity.keyId,
            keyName: "Public API proof",
            inboundEventId,
            company: "",
            stage: null,
            note: "",
        }
        await deliver(payload, "public_api")
        const [work] = await publicApiWork(world, identity.workspaceId)
        assert(work !== undefined)
        expect(work).toMatchObject({ lead_id: known.id, proposal: { fields: { channel_label: "Partner referral" } } })
        const completed = await world
            .resolve(WorkEngineService)
            .runQueuedItem({ workspaceId: identity.workspaceId, actor: "NIVO", locale: "en" }, work.id)
        expect(completed).toMatchObject({ status: "done", lead_id: known.id })
        expect(await world.resolve(LeadRecordsService).find(identity.workspaceId, known.id)).toMatchObject({
            channel: "Partner referral",
            need: RETAINED_NEED,
            contact_name: "Renamed existing customer",
        })
        const workAfter = await publicApiWork(world, identity.workspaceId)
        await deliver(payload, "public_api")
        expect(await publicApiWork(world, identity.workspaceId)).toEqual(workAfter)
    })
})

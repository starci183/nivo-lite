import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { persistPublicApiInbound } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiInbound } from "../../world/public-api-database.service"

describe("Public API unresolved-legacy-lead (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, inbox } = preparePublicApiProof(world)

    it("preserves an unresolved historical handoff when its original channel cannot be recovered", async () => {
        const identity = await fixture()
        const inboundEventId = world.id()
        await persistPublicApiInbound(world.db.primary, {
            id: inboundEventId,
            workspaceId: identity.workspaceId,
            channel: "manual",
            kind: "lead",
            senderName: "Unresolved historical customer",
            body: "Original historical need",
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
            company: "",
            stage: null,
            note: "",
        }
        const original = await apiInbound(world.db.primary, identity.workspaceId)
        await expect(deliver(payload, "public_api")).rejects.toMatchObject({
            code: "PUBLIC_API_REQUEST_INVALID",
            params: { field: "legacyChannel" },
        })
        expect(await apiInbound(world.db.primary, identity.workspaceId)).toEqual(original)
        expect(await publicApiWork(world, identity.workspaceId)).toEqual([])
        expect(await inbox(identity.workspaceId)).toEqual([])
    })
})

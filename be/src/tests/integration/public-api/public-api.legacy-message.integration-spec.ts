import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { persistPublicApiConversation } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES, PublicApiProofDelivery } from "../../world/public-api-capabilities.options"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiEvents } from "../../world/public-api-database.service"

describe("Public API legacy-message (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    it("holds a historical inline message that asked for approval once, however often it is delivered", async () => {
        const identity = await fixture()
        const conversationId = await persistPublicApiConversation(
            world,
            identity,
            world.id(),
        )
        const payload = {
            kind: "message",
            workspaceId: identity.workspaceId,
            keyId: identity.keyId,
            keyName: "Public API proof",
            conversationId,
            text: "Original historical text",
            requireApproval: true,
            dedupeKey: `api.message:historical:${world.id()}`,
        }
        const channel = world.resolve(PublicApiProofDelivery)
        const before = channel.toPerson.length

        await deliver(payload, "public_api")
        await deliver(payload, "public_api")

        expect(channel.toPerson.length).toBe(before)
        const held = (await apiEvents(world.db.primary, identity.workspaceId)).filter(
            (event) => event.kind === "api.message.held",
        )
        expect(held).toHaveLength(1)
    })
})

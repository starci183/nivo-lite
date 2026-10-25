import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { persistPublicApiConversation } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API legacy-message (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    it("retains a historical inline message's original work dedupe and approval", async () => {
        const identity = await fixture()
        const conversationId = world.id()
        const leadId = world.id()
        await persistPublicApiConversation(world.db.primary, identity, conversationId, leadId)
        const dedupeKey = `api.message:historical:${world.id()}`
        const payload = {
            kind: "message",
            workspaceId: identity.workspaceId,
            keyId: identity.keyId,
            keyName: "Public API proof",
            conversationId,
            leadId,
            text: "Original historical draft",
            requireApproval: true,
            dedupeKey,
        }
        await deliver(payload, "public_api")
        await deliver(payload, "public_api")
        expect(await publicApiWork(world, identity.workspaceId)).toMatchObject([
            {
                action: "reply_customer",
                dedupe_key: dedupeKey,
                proposal: {
                    draft: "Original historical draft",
                    execution: { preset: true, noChain: true, forceAsk: "over_authority" },
                },
            },
        ])
    })
})

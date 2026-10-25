import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicKnowledgeService } from "@modules/domain/public-api"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API routing (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, source, inbox } = preparePublicApiProof(world)

    it("rejects an unregistered job name before a claim or domain effect", async () => {
        const identity = await fixture()
        const accepted = await world.resolve(PublicKnowledgeService).acceptKnowledge({
            authorization: identity.authorization,
            title: "Unknown job proof",
            content: "An unrelated job cannot fulfill this admission.",
        })
        const payload = { workspaceId: identity.workspaceId, requestId: accepted.id }
        await expect(deliver(payload, "public-api.unregistered")).rejects.toMatchObject({
            code: "QUEUE_HANDLER_MISSING",
        })
        expect(await source(identity.workspaceId, accepted.id)).toEqual([])
        expect(await inbox(identity.workspaceId)).toEqual([])
        expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toBeNull()
    })
})

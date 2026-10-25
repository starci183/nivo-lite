import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicKnowledgeService } from "@modules/domain/public-api"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { claimPublicApi, publicApiRequest } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API fencing (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { registered, fixture, source, inbox } = preparePublicApiProof(world)

    it("rejects a stale fence before any request effect", async () => {
        const identity = await fixture()
        const accepted = await world.resolve(PublicKnowledgeService).acceptKnowledge({
            authorization: identity.authorization,
            title: "Fence proof",
            content: "Only the live claimant may write.",
        })
        const payload = { workspaceId: identity.workspaceId, requestId: accepted.id }
        const claim = await claimPublicApi(world, payload)
        await claim.claims.fail({
            jobId: claim.job.jobId,
            expectedFencingToken: claim.job.fencingToken,
            reason: "superseded",
        })
        const live = await claim.claim()
        await expect(registered().processor.process(claim.job)).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        expect(await source(identity.workspaceId, accepted.id)).toEqual([])
        expect(await inbox(identity.workspaceId)).toEqual([])
        await registered().processor.process(live)
        expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toBeInstanceOf(Date)
    })
})

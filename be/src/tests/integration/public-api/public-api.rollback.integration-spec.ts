import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicApiProcessingService, PublicKnowledgeService } from "@modules/domain/public-api"
import * as statements from "../../fixtures/persistence/public-api.sql"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { claimPublicApi, publicApiRequest } from "../../world/public-api-proof.service"
import type { PublicApiRequestState } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API rollback (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { registered, fixture, source, inbox, outbox } = preparePublicApiProof(world)

    it("rolls inbox, source, downstream outbox and completion back together, then permits retry", async () => {
        const identity = await fixture()
        const accepted = await world.resolve(PublicKnowledgeService).acceptKnowledge({
            authorization: identity.authorization,
            title: "Rollback proof",
            content: "A retry must still index this source.",
        })
        const payload = { workspaceId: identity.workspaceId, requestId: accepted.id }
        const processing = world.resolve(PublicApiProcessingService)
        const fulfill = processing.process.bind(processing)
        const failure = new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
        jest.spyOn(processing, "process").mockImplementationOnce(async (input, tx) => {
            expect(tx.queryRunner?.isTransactionActive).toBe(true)
            await fulfill(input, tx)
            const [uncommitted] = await tx.query<Array<PublicApiRequestState>>(statements.API_REQUEST, [
                identity.workspaceId,
                accepted.id,
            ])
            expect(uncommitted?.processed_at).toBeInstanceOf(Date)
            expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toBeNull()
            expect(await source(identity.workspaceId, accepted.id)).toEqual([])
            throw failure
        })
        const claim = await claimPublicApi(world, payload)
        await expect(registered().processor.process(claim.job)).rejects.toBe(failure)
        expect(await source(identity.workspaceId, accepted.id)).toEqual([])
        expect((await outbox(identity.workspaceId)).filter((row) => row.name === "knowledge.index")).toEqual([])
        expect(await inbox(identity.workspaceId)).toEqual([])
        expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toBeNull()
        await claim.claims.fail({
            jobId: claim.job.jobId,
            expectedFencingToken: claim.job.fencingToken,
            reason: failure.message,
        })
        await registered().processor.process(await claim.claim())
        expect(await source(identity.workspaceId, accepted.id)).toHaveLength(1)
        expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toBeInstanceOf(Date)
    })
})

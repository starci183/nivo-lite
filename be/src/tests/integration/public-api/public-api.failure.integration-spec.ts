import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicKnowledgeService } from "@modules/domain/public-api"
import { PUBLIC_API_QUEUE } from "@modules/queues/public-api"
import * as statements from "../../fixtures/persistence/public-api.sql"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest, publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API failure (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { registered, fixture, source } = preparePublicApiProof(world)

    it.each(["public-api.request", "public_api"])(
        "retains one terminal failure evidence line for the original %s delivery while its admission stays pending",
        async (job) => {
            const identity = await fixture()
            const accepted = await world.resolve(PublicKnowledgeService).acceptKnowledge({
                authorization: identity.authorization,
                title: "Terminal failure proof",
                content: "Operator recovery must retain this pending admission.",
            })
            const delivery = {
                id: world.id(),
                queue: PUBLIC_API_QUEUE,
                job,
                payload: { workspaceId: identity.workspaceId, requestId: accepted.id },
                attempt: 4,
                signal: new AbortController().signal,
            }
            world.cleanup(() => world.db.primary.query(statements.CLEAN_API_FAILED_RECEIPT, [delivery.id]))
            const failed = registered().handler.failed
            assert(failed !== undefined)
            const cause = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
            await failed(delivery, cause)
            await failed(delivery, cause)
            const evidence = await world.db.primary.query<Array<{ readonly kind: string; readonly evidence: string }>>(
                statements.API_EVENTS,
                [identity.workspaceId],
            )
            expect(evidence.filter((event) => event.kind === "api.failed")).toEqual([
                expect.objectContaining({ actor: "NIVO", evidence: delivery.id }),
            ])
            expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toBeNull()
            expect(await source(identity.workspaceId, accepted.id)).toEqual([])
            expect(await publicApiWork(world, identity.workspaceId)).toEqual([])
        },
    )
})

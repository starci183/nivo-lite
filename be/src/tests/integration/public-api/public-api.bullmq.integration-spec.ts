import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicKnowledgeService } from "@modules/domain/public-api"
import { publicApiProofModules } from "../../world/public-api-capabilities.options"
import { publicApiRequest } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { worldIds } from "../../world/lite-world.service"
import { redisProofOptions } from "../../world/redis-capabilities.options"
import { startQueueRelay, transportOf, waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import { API_REDIS_JOB } from "../../fixtures/persistence/redis-proof.sql"

describe("Public API consumer over BullMQ (private local integration)", () => {
    const world = useTestWorld({
        modules: [
            ...publicApiProofModules(redisProofOptions(`public-api-redis-${worldIds.next()}`)),
            ProcessPublicApiQueueModule.register({}),
        ],
    })
    const { registered, fixture, source, outbox } = preparePublicApiProof(world)

    it("publishes the accepted request under its durable id and runs its registered fenced consumer", async () => {
        const identity = await fixture()
        const accepted = await world.resolve(PublicKnowledgeService).acceptKnowledge({
            authorization: identity.authorization,
            title: "Redis delivery policy",
            content: "An accepted request is processed through the declared BullMQ broker.",
        })
        const publications = await outbox(identity.workspaceId)
        expect(publications.find((row) => row.queue === "public_api")).toBeDefined()
        const transport = transportOf(world)
        await transport.work(registered().handler, 1)
        startQueueRelay(world)
        await waitForProof(
            () => publicApiRequest(world, identity.workspaceId, accepted.id),
            (row) => row.processed_at !== null,
        )
        expect(await source(identity.workspaceId, accepted.id)).toHaveLength(1)
        const completed = await world.db.primary.query<Array<{ readonly id: string; readonly state: string }>>(
            API_REDIS_JOB,
            [accepted.id],
        )
        expect(completed).toEqual([expect.objectContaining({ state: "done" })])
        const id = completed[0]?.id
        expect(id).toBeDefined()
        if (id !== undefined) {
            await waitForProof(
                () => transport.stateOf("public_api", id),
                (state) => state === "completed",
            )
        }
        expect((await outbox(identity.workspaceId)).filter((row) => row.name === "knowledge.index")).toHaveLength(1)
    })
})

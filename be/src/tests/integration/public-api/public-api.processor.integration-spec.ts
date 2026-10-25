import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicKnowledgeService } from "@modules/domain/public-api"
import { PUBLIC_API_QUEUE } from "@modules/queues/public-api"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { publicApiRequest } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API processor (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { registered, fixture, deliver, source, inbox, outbox } = preparePublicApiProof(world)

    it("registers the public API queue and writes a knowledge source with the promised ledger id exactly once", async () => {
        const identity = await fixture()
        const accepted = await world.resolve(PublicKnowledgeService).acceptKnowledge({
            authorization: identity.authorization,
            title: "Service policy",
            content: "Annual contracts include one on-site visit.",
            topic: "service",
            tags: [" annual ", "contract"],
            visibility: "public",
        })
        const payload = { workspaceId: identity.workspaceId, requestId: accepted.id }
        expect(registered().registered.map((processor) => ({ queue: processor.queue, job: processor.job }))).toEqual([
            { queue: PUBLIC_API_QUEUE, job: "public-api.request" },
            { queue: PUBLIC_API_QUEUE, job: "public_api" },
        ])
        await deliver(payload)
        const committed = await publicApiRequest(world, identity.workspaceId, accepted.id)
        expect(committed.processed_at).toBeInstanceOf(Date)
        expect(await source(identity.workspaceId, accepted.id)).toEqual([
            expect.objectContaining({
                id: accepted.id,
                title: "Service policy",
                topic: "service",
                tags: ["annual", "contract"],
                visibility: "public",
                origin: "api:Public API proof",
            }),
        ])
        expect((await outbox(identity.workspaceId)).filter((row) => row.name === "knowledge.index")).toEqual([
            expect.objectContaining({ dedupe_key: `knowledge.index:${accepted.id}` }),
        ])
        const receipts = await inbox(identity.workspaceId)
        await deliver(payload, "public_api")
        expect(await source(identity.workspaceId, accepted.id)).toHaveLength(1)
        expect((await outbox(identity.workspaceId)).filter((row) => row.name === "knowledge.index")).toHaveLength(1)
        expect(await inbox(identity.workspaceId)).toEqual(receipts)
        expect((await publicApiRequest(world, identity.workspaceId, accepted.id)).processed_at).toEqual(
            committed.processed_at,
        )
    })
})

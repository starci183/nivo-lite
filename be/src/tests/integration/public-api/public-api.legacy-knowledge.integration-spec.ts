import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { persistPublicApiSource } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES } from "../../world/public-api-capabilities.options"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API legacy-knowledge (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver, source, outbox } = preparePublicApiProof(world)

    it("indexes the original inline historical source without creating another source", async () => {
        const identity = await fixture()
        const sourceId = world.id()
        await persistPublicApiSource(world.db.primary, {
            id: sourceId,
            workspaceId: identity.workspaceId,
            kind: "text",
            title: "Existing historical source",
            content: "Already admitted before the ledger",
        })
        const payload = { kind: "knowledge", workspaceId: identity.workspaceId, sourceId }
        await deliver(payload, "public_api")
        await deliver(payload, "public_api")
        expect(await source(identity.workspaceId, sourceId)).toEqual([
            expect.objectContaining({ content: "Already admitted before the ledger" }),
        ])
        expect((await outbox(identity.workspaceId)).filter((row) => row.name === "knowledge.index")).toHaveLength(1)
    })
})

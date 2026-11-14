import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { PublicMessagesService } from "@modules/domain/public-api"
import { persistPublicApiConversation } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES, PublicApiProofDelivery } from "../../world/public-api-capabilities.options"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiEvents, apiMessageRequest, backdateApiRequest } from "../../world/public-api-database.service"

describe("Public API stale message (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    it("holds a message admitted more than 24 hours ago even when it asked for no approval", async () => {
        const identity = await fixture()
        const conversationId = await persistPublicApiConversation(
            world,
            identity,
            world.id(),
        )
        await world.resolve(PublicMessagesService).acceptMessage({
            authorization: identity.authorization,
            conversationId,
            text: "A day-old API text",
            requireApproval: false,
            idempotencyKey: "stale-message",
        })
        const [request] = await apiMessageRequest(world.db.primary, identity.workspaceId, conversationId)
        assert(request !== undefined)
        await backdateApiRequest(world.db.primary, identity.workspaceId, request.id, 25)
        const channel = world.resolve(PublicApiProofDelivery)
        const before = channel.toPerson.length

        await deliver({ workspaceId: identity.workspaceId, requestId: request.id })

        expect(channel.toPerson.length).toBe(before)
        expect(await apiEvents(world.db.primary, identity.workspaceId)).toContainEqual(
            expect.objectContaining({ kind: "api.message.held", evidence: "A day-old API text" }),
        )
    })

    it("holds a pre-ledger inline message even when it asked for no approval", async () => {
        const identity = await fixture()
        const conversationId = await persistPublicApiConversation(
            world,
            identity,
            world.id(),
        )
        const channel = world.resolve(PublicApiProofDelivery)
        const before = channel.toPerson.length

        await deliver(
            {
                kind: "message",
                workspaceId: identity.workspaceId,
                keyId: identity.keyId,
                keyName: "Public API proof",
                conversationId,
                text: "Historical text without approval",
                requireApproval: false,
                dedupeKey: `api.message:historical:${world.id()}`,
            },
            "public_api",
        )

        expect(channel.toPerson.length).toBe(before)
        expect(await apiEvents(world.db.primary, identity.workspaceId)).toContainEqual(
            expect.objectContaining({ kind: "api.message.held", evidence: "Historical text without approval" }),
        )
    })
})

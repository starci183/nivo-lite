import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { PublicMessagesService } from "@modules/domain/public-api"
import { persistPublicApiConversation } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES, PublicApiProofDelivery } from "../../world/public-api-capabilities.options"
import { publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { useTestWorld } from "../../world/use-test-world"
import { apiEvents, apiMessageRequest } from "../../world/public-api-database.service"

describe("Public API message (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    const admittedMessage = async (approval: boolean) => {
        const identity = await fixture()
        const conversationId = await persistPublicApiConversation(
            world,
            identity,
            world.id(),
        )
        await world.resolve(PublicMessagesService).acceptMessage({
            authorization: identity.authorization,
            conversationId,
            text: "The exact API text",
            requireApproval: approval,
            idempotencyKey: "same-message",
        })
        const [request] = await apiMessageRequest(world.db.primary, identity.workspaceId, conversationId)
        assert(request !== undefined)
        return { ...identity, conversationId, request }
    }

    it("claims the exact text once as a delivery-ledger row of the route, delivers it once after commit, stores no chat line and opens no work item", async () => {
        const message = await admittedMessage(false)
        const channel = world.resolve(PublicApiProofDelivery)
        const before = channel.toPerson.length
        const payload = { workspaceId: message.workspaceId, requestId: message.request.id }

        await deliver(payload)
        await deliver(payload)

        // The conversation id of the API is the route id: the message is sent to the person on it, once, under the request's key.
        const sent = channel.toPerson.slice(before)
        expect(sent).toHaveLength(1)
        expect(sent[0]).toMatchObject({ routeId: message.conversationId, text: "The exact API text", sendKey: `api.message:${message.request.id}` })
        expect(channel.delivered).toHaveLength(0)
        await expect(world.resolve(ChannelDeliveriesService).byKey(message.workspaceId, `api.message:${message.request.id}`)).resolves.toMatchObject({
            routeId: message.conversationId,
            text: "The exact API text",
            state: "delivered",
        })
        expect(await publicApiWork(world, message.workspaceId)).toEqual([])
    })

    it("holds a message the caller asked to approve: nothing is delivered and the hold is recorded", async () => {
        const message = await admittedMessage(true)
        const channel = world.resolve(PublicApiProofDelivery)
        const before = channel.toPerson.length

        await deliver({ workspaceId: message.workspaceId, requestId: message.request.id })

        expect(channel.toPerson.length).toBe(before)
        expect(await apiEvents(world.db.primary, message.workspaceId)).toContainEqual(
            expect.objectContaining({ kind: "api.message.held", evidence: "The exact API text" }),
        )
    })
})

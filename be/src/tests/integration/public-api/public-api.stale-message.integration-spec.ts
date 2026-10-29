import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { WorkEngineService, WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformer, WorkPerformerRegistry } from "@modules/domain/decisions"
import { PublicMessagesService } from "@modules/domain/public-api"
import { persistPublicApiConversation } from "../../fixtures/builders/public-api.builder"
import { PUBLIC_API_PROOF_MODULES, PublicApiProofAccess } from "../../world/public-api-capabilities.options"
import type { LiteWorld } from "../../world/lite-world.service"
import { publicApiWork } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"
import { apiMessageRequest, backdateApiRequest } from "../../world/public-api-database.service"

/** Lets the workspace's own authority send automatically and records whether a send happened. */
const automaticSender = (world: LiteWorld) => {
    world.resolve(PublicApiProofAccess).access = "auto"
    const prepare = jest
        .fn<ReturnType<WorkPerformer["prepare"]>, Parameters<WorkPerformer["prepare"]>>()
        .mockRejectedValue(new TestWorldError({ code: TestWorldErrorCode.ProviderDown }))
    const perform = jest
        .fn<ReturnType<WorkPerformer["perform"]>, Parameters<WorkPerformer["perform"]>>()
        .mockResolvedValue({ summary: "Synthetic outbound accepted", evidence: "captured" })
    world.resolve<WorkPerformerRegistry>(WORK_PERFORMER_REGISTRY).add("reply_customer", { prepare, perform })
    return perform
}

/** The single handoff keeps its draft, is forced to approval and waits for a decision when the engine runs it. */
const expectHeldForApproval = async (world: LiteWorld, workspaceId: string, draft: string) => {
    const [work] = await publicApiWork(world, workspaceId)
    assert(work !== undefined)
    expect(work).toMatchObject({
        action: "reply_customer",
        status: "queued",
        proposal: { draft, execution: { preset: true, noChain: true, forceAsk: "over_authority" } },
    })
    const ctx = { workspaceId, actor: "NIVO", locale: "en" } as const
    expect(await world.resolve(WorkEngineService).runQueuedItem(ctx, work.id)).toMatchObject({
        status: "waiting_decision",
    })
}

describe("Public API stale message (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    it("holds a message admitted more than 24 hours ago for approval under automatic authority", async () => {
        const identity = await fixture()
        const conversationId = world.id()
        await persistPublicApiConversation(world.db.primary, identity, conversationId, world.id())
        await world.resolve(PublicMessagesService).acceptMessage({
            authorization: identity.authorization,
            conversationId,
            text: "A day-old API draft",
            requireApproval: false,
            idempotencyKey: "stale-message",
        })
        const [request] = await apiMessageRequest(world.db.primary, identity.workspaceId, conversationId)
        assert(request !== undefined)
        await backdateApiRequest(world.db.primary, identity.workspaceId, request.id, 25)
        const perform = automaticSender(world)

        await deliver({ workspaceId: identity.workspaceId, requestId: request.id })

        await expectHeldForApproval(world, identity.workspaceId, "A day-old API draft")
        expect(perform).not.toHaveBeenCalled()
    })

    it("holds a pre-ledger inline message for approval even when it asked for none", async () => {
        const identity = await fixture()
        const conversationId = world.id()
        const leadId = world.id()
        await persistPublicApiConversation(world.db.primary, identity, conversationId, leadId)
        const perform = automaticSender(world)

        await deliver(
            {
                kind: "message",
                workspaceId: identity.workspaceId,
                keyId: identity.keyId,
                keyName: "Public API proof",
                conversationId,
                leadId,
                text: "Historical draft without approval",
                requireApproval: false,
                dedupeKey: `api.message:historical:${world.id()}`,
            },
            "public_api",
        )

        await expectHeldForApproval(world, identity.workspaceId, "Historical draft without approval")
        expect(perform).not.toHaveBeenCalled()
    })
})

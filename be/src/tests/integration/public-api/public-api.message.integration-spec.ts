import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { WorkEngineService, WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformer, WorkPerformerRegistry } from "@modules/domain/decisions"
import { PublicMessagesService } from "@modules/domain/public-api"
import { persistPublicApiConversation } from "../../fixtures/builders/public-api.builder"
import * as statements from "../../fixtures/persistence/public-api.sql"
import { PUBLIC_API_PROOF_MODULES, PublicApiProofAccess } from "../../world/public-api-capabilities.options"
import { publicApiWork } from "../../world/public-api-proof.service"
import type { PublicApiRequestState } from "../../world/public-api-proof.service"
import { preparePublicApiProof } from "../../world/public-api-suite.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"

describe("Public API message (persisted local integration)", () => {
    const world = useTestWorld({ modules: [...PUBLIC_API_PROOF_MODULES, ProcessPublicApiQueueModule.register({})] })
    const { fixture, deliver } = preparePublicApiProof(world)

    const admittedMessage = async (approval: boolean) => {
        const identity = await fixture()
        const conversationId = world.id()
        await persistPublicApiConversation(world.db.primary, identity, conversationId, world.id())
        await world.resolve(PublicMessagesService).acceptMessage({
            authorization: identity.authorization,
            conversationId,
            text: "The exact approved API draft",
            requireApproval: approval,
            idempotencyKey: "same-message",
        })
        const [request] = await world.db.primary.query<Array<PublicApiRequestState>>(statements.API_MESSAGE_REQUEST, [
            identity.workspaceId,
            conversationId,
        ])
        assert(request !== undefined)
        return { ...identity, conversationId, request }
    }

    it.each([
        { label: "automatic authority", approval: false, access: "auto", status: "done", performed: 1 },
        { label: "forced approval", approval: true, access: "auto", status: "waiting_decision", performed: 0 },
        { label: "connection asks first", approval: false, access: "ask", status: "waiting_decision", performed: 0 },
    ] as const)(
        "keeps the message draft behind $label and never sends twice",
        async ({ approval, access, status, performed }) => {
            const message = await admittedMessage(approval)
            world.resolve(PublicApiProofAccess).access = access
            const prepare = jest
                .fn<ReturnType<WorkPerformer["prepare"]>, Parameters<WorkPerformer["prepare"]>>()
                .mockRejectedValue(new TestWorldError({ code: TestWorldErrorCode.ProviderDown }))
            const perform = jest
                .fn<ReturnType<WorkPerformer["perform"]>, Parameters<WorkPerformer["perform"]>>()
                .mockResolvedValue({ summary: "Synthetic outbound accepted", evidence: "captured" })
            world.resolve<WorkPerformerRegistry>(WORK_PERFORMER_REGISTRY).add("reply_customer", { prepare, perform })
            const payload = { workspaceId: message.workspaceId, requestId: message.request.id }
            await deliver(payload)
            const [work] = await publicApiWork(world, message.workspaceId)
            assert(work !== undefined)
            expect(work).toMatchObject({
                action: "reply_customer",
                status: "queued",
                proposal: { draft: "The exact approved API draft", execution: { preset: true, noChain: true } },
            })
            expect(perform).not.toHaveBeenCalled()
            const engine = world.resolve(WorkEngineService)
            const ctx = { workspaceId: message.workspaceId, actor: "NIVO", locale: "en" } as const
            expect(await engine.runQueuedItem(ctx, work.id)).toMatchObject({ status })
            expect(prepare).not.toHaveBeenCalled()
            expect(perform).toHaveBeenCalledTimes(performed)
            await deliver(payload)
            expect(await engine.runQueuedItem(ctx, work.id)).toBeNull()
            expect(perform).toHaveBeenCalledTimes(performed)
            expect(await publicApiWork(world, message.workspaceId)).toHaveLength(1)
        },
    )
})

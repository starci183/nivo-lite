import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import {
    outputApprovalRequestOf,
    persistOutputGraphStop,
    persistOutputProofTurn,
    setOutputProofChannel,
} from "../../fixtures/builders/output-approval-world.builder"
import assert from "node:assert/strict"
import { AgentMessagesService, agentMessagesEntities } from "@modules/domain/agent-messages"
import { AgentRunsService, AgentRunSweepService } from "@modules/domain/agent-runs"
import { ChannelDeliveryService } from "@modules/domain/channels"
import {
    DecisionLogReadService,
    DecisionsError,
    DecisionsErrorCode,
    DurableWorkService,
    WorkEngineService,
} from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { CustomerDeliveryService } from "@modules/domain/work-performers"
import { WorkItemsService, workItemsEntities } from "@modules/domain/work-items"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { AgentRunTraceService } from "../../../modules/domain/agent-runs/agent-run-trace.service"
import { ApprovalStepHandlerService } from "../../../modules/domain/customer-turns/approval-step-handler.service"
import { FinalReplyStepHandlerService } from "../../../modules/domain/customer-turns/final-reply-step-handler.service"
import { OutputApprovalService } from "../../../modules/domain/customer-turns/output-approval.service"
import { OutputStepHandlerService } from "../../../modules/domain/customer-turns/output-step-handler.service"
import { WorkItemClosedService } from "../../../modules/domain/decisions/work-item-closed.service"
import { WorkRecorderService } from "../../../modules/domain/decisions/work-recorder.service"
import { WorkPerformersRegistrarService } from "../../../modules/domain/work-performers/work-performers-registrar.service"
import { GatewayCallPerformerService } from "../../../modules/domain/work-performers/gateway-call-performer.service"
import { AgentGraphWaitTimeoutService } from "../../../modules/domain/agent-graphs/agent-graph-wait-timeout.service"
import { outputProofSandbox } from "../../world/output-proof-sandbox.service"
import { API_APP_MODULES } from "../../world/api-app.options"
import { useTestWorld } from "../../world/use-test-world"
import { sceneOf } from "@tests/world/agent-runs-scene.service"
import {
    soleStepOfKind,
    stepRecordsIn,
    stepRecordsOf,
    stepRecordsOfKind,
} from "../../world/agent-runs-database.service"

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: outputProofSandbox() })
const scene = sceneOf(world)
const [MessageEntity] = agentMessagesEntities
const [MemberEntity] = workspaceMembersEntities
const [, , , , GraphDecisionEntity] = agentGraphsEntities
const [WorkItemEntity] = workItemsEntities
const conversationId = world.id()
const customerMessageId = world.id()
const installationId = world.id()
const identity = {
    workspaceId: scene.workspaceId,
    agentId: scene.agentId,
    conversationId,
    customerMessageId,
    installationId,
}
const ctx: WorkContext = { workspaceId: scene.workspaceId, actor: "Approval proof", locale: "en" }
const em = () => world.db.primary

beforeAll(async () => {
    world.resolve(WorkPerformersRegistrarService).onModuleInit()
    world.resolve(ApprovalStepHandlerService).onModuleInit()
    world.resolve(OutputStepHandlerService).onModuleInit()
    world.resolve(FinalReplyStepHandlerService).onModuleInit()
    await persistOutputProofTurn(em(), identity)
})

afterEach(() => jest.restoreAllMocks())

const held = async (label: string) => {
    const run = await scene.newRun(label, [])
    const item = await world
        .resolve(OutputApprovalService)
        .ask(ctx, outputApprovalRequestOf(identity, run.wakeId, world.key(label)))
    assert.equal(item.status, "waiting_decision")
    return { ...run, item }
}

const owner = async () => {
    const member = await em().findOneOrFail(MemberEntity, { where: { workspaceId: scene.workspaceId, role: "owner" } })
    return { name: "Human display label", kind: "owner" as const, memberId: member.id }
}

/** An explicit interleaving point; no elapsed-time sleep decides which writer owns the row. */
const barrier = () => {
    let done: (() => void) | undefined
    const promise = new Promise<void>((resolve) => {
        done = resolve
    })
    return {
        promise,
        release(): void {
            assert(done !== undefined)
            done()
        },
    }
}

describe("output approval: real database registration", () => {
    it("rolls back both the inserted item and its wait when registration aborts after writing them", async () => {
        const { wakeId, runId } = await scene.newRun("registration-rollback", [])
        const request = outputApprovalRequestOf(identity, wakeId, world.key("registration-rollback"))
        const aborted = new DecisionsError({ code: DecisionsErrorCode.NotFound })
        const runs = world.resolve(AgentRunsService)
        const waitOn = runs.waitOn.bind(runs)
        jest.spyOn(runs, "waitOn").mockImplementationOnce(async (tx, input) => {
            await waitOn(tx, input)
            expect(await tx.count(WorkItemEntity, { where: { id: input.workItemId } })).toBe(1)
            expect(
                (await stepRecordsIn(world, tx, scene.workspaceId, runId)).filter(
                    (step) => step.waitItemId === input.workItemId,
                ),
            ).toHaveLength(1)
            throw aborted
        })
        const expose = jest.spyOn(world.resolve(WorkEngineService), "runQueuedItem")
        await expect(world.resolve(OutputApprovalService).ask(ctx, request)).rejects.toBe(aborted)
        expect(await world.resolve(WorkItemsService).findByDedupe(ctx.workspaceId, request.spec.dedupeKey)).toBeNull()
        expect(await stepRecordsOf(world, scene.workspaceId, runId)).toHaveLength(0)
        expect(expose).not.toHaveBeenCalled()
    })

    it("admits concurrent same-key asks as one item and one wait without an output before decision", async () => {
        const { wakeId, runId } = await scene.newRun("registration-concurrent", [])
        const request = outputApprovalRequestOf(identity, wakeId, world.key("registration-concurrent"))
        const bothEntered = barrier()
        let arrivals = 0
        const durable = world.resolve(DurableWorkService)
        const enqueue = durable.enqueueWork.bind(durable)
        jest.spyOn(durable, "enqueueWork").mockImplementation(async (...args) => {
            arrivals += 1
            if (arrivals === 2) bothEntered.release()
            await bothEntered.promise
            return enqueue(...args)
        })
        const approvals = world.resolve(OutputApprovalService)
        const [first, second] = await Promise.all([approvals.ask(ctx, request), approvals.ask(ctx, request)])
        expect(second.id).toBe(first.id)
        expect(
            await em().count(WorkItemEntity, {
                where: { workspaceId: ctx.workspaceId, dedupeKey: request.spec.dedupeKey },
            }),
        ).toBe(1)
        expect(await em().findOneByOrFail(WorkItemEntity, { id: first.id })).toMatchObject({
            status: "waiting_decision",
        })
        expect(await stepRecordsOfKind(world, scene.workspaceId, runId, "approval")).toMatchObject([
            { status: "running", waitItemId: first.id },
        ])
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).length).toBe(0)
        expect((await world.resolve(DecisionLogReadService).decidersOf([first.id])).has(first.id)).toBe(false)
    })
})

describe("output approval: real database registration", () => {
    it("recovers the committed queued item and wait when the caller dies before runQueuedItem starts", async () => {
        const { wakeId, runId } = await scene.newRun("registration-before-queue-kill", [])
        const request = outputApprovalRequestOf(identity, wakeId, world.key("registration-before-queue-kill"))
        const engine = world.resolve(WorkEngineService)
        const stopped = jest
            .spyOn(engine, "runQueuedItem")
            .mockRejectedValueOnce(new Error("proof-killed-before-queue"))
        await expect(world.resolve(OutputApprovalService).ask(ctx, request)).rejects.toThrow(
            "proof-killed-before-queue",
        )
        const item = await world.resolve(WorkItemsService).findByDedupe(ctx.workspaceId, request.spec.dedupeKey)
        assert(item !== null)
        expect(item.status).toBe("queued")
        expect(await soleStepOfKind(world, scene.workspaceId, runId, "approval")).toMatchObject({
            status: "running",
            waitItemId: item.id,
        })
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).length).toBe(0)
        stopped.mockRestore()
        expect(await engine.runQueued(ctx, 1)).toBe(1)
        expect((await world.resolve(WorkItemsService).findMany([item.id], 1))[0]?.status).toBe("waiting_decision")
        expect(await world.resolve(AgentRunsService).waitsOn(ctx.workspaceId, item.id)).toBe(true)
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).length).toBe(0)
        const by = await owner()
        await engine.resumeWork(ctx, item.id, "approved", {}, by)
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "approval")).length).toBe(1)
        expect(await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).toMatchObject([
            { status: "pending", input: { scope: { approvedBy: by.memberId, workItemId: item.id } } },
        ])
    })
})

describe("output approval: real database close and recovery", () => {
    it("recovers the recorded principal and edited calls after losing the post-commit callback", async () => {
        const { item, runId } = await held("output-close-kill")
        const by = await owner()
        jest.spyOn(world.resolve(WorkItemClosedService), "tell").mockResolvedValueOnce(undefined)
        await world.resolve(WorkEngineService).resumeWork(
            ctx,
            item.id,
            "approved",
            {
                fields: { args_json: '{"qty":1}' },
                draft: "One approved unit",
            },
            by,
        )
        expect((await world.resolve(WorkItemsService).findMany([item.id], 1))[0]?.status).toBe("done")
        expect((await world.resolve(DecisionLogReadService).decidersOf([item.id])).get(item.id)).toBe(by.memberId)
        expect(await world.resolve(AgentRunsService).waitsOn(scene.workspaceId, item.id)).toBe(true)
        await world.resolve(AgentRunSweepService).sweep()
        await world.resolve(AgentRunSweepService).sweep()
        const steps = await world.resolve(AgentRunTraceService).stepsOf(scene.workspaceId, runId)
        expect(steps.filter((step) => step.kind === "approval")).toHaveLength(1)
        const outputs = await stepRecordsOfKind(world, scene.workspaceId, runId, "output")
        expect(outputs).toHaveLength(1)
        expect(outputs[0]?.input).toMatchObject({
            argsJson: '{"qty":1}',
            scope: {
                approvedBy: by.memberId,
                workItemId: item.id,
                conversationId,
                planned: "One approved unit",
            },
        })
    })

    it("refuses late execution after its persisted wait ended even when the marker is edited away", async () => {
        const { item, runId } = await held("output-late-approval")
        await em().transaction((tx) =>
            world
                .resolve(AgentRunsService)
                .resumeWaiting(scene.workspaceId, tx, item.id, { approved: false, by: "timeout" }),
        )
        await expect(
            world
                .resolve(WorkEngineService)
                .resumeWork(ctx, item.id, "approved", { fields: { in_run: "false" } }, await owner()),
        ).rejects.toMatchObject({ code: "WORK_PERFORMERS_APPROVAL_INVALID" })
        const steps = await world.resolve(AgentRunTraceService).stepsOf(scene.workspaceId, runId)
        expect(steps.filter((step) => step.kind === "output")).toHaveLength(0)
        expect((await world.resolve(DecisionLogReadService).decidersOf([item.id])).has(item.id)).toBe(false)
    })
})

describe("output approval: real database close and recovery", () => {
    it("defers expiry when the owner already reopened the item and then records one approved outcome", async () => {
        const { item, runId } = await held("owner-before-timeout")
        await scene.expireClaims(runId)
        const entered = barrier()
        const proceed = barrier()
        const performer = world.resolve(GatewayCallPerformerService)
        const perform = performer.perform.bind(performer)
        jest.spyOn(performer, "perform").mockImplementationOnce(async (...args) => {
            entered.release()
            await proceed.promise
            return perform(...args)
        })
        const ownerTask = world.resolve(WorkEngineService).resumeWork(ctx, item.id, "approved", {}, await owner())
        await entered.promise
        try {
            await world.resolve(AgentRunSweepService).sweep()
            const before = await soleStepOfKind(world, scene.workspaceId, runId, "approval")
            expect(before).toMatchObject({ status: "running", waitItemId: item.id })
            expect((await world.resolve(WorkItemsService).findMany([item.id], 1))[0]?.status).toBe("queued")
        } finally {
            proceed.release()
        }
        await ownerTask
        const approval = await soleStepOfKind(world, scene.workspaceId, runId, "approval")
        expect(approval.result).toMatchObject({ approved: true })
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).length).toBe(1)
        expect((await world.resolve(WorkItemsService).findMany([item.id], 1))[0]?.status).toBe("done")
    })
})

describe("output approval: real database close and recovery", () => {
    it("a timeout holding the decision row wins before a later owner reopen and cannot leave approved history", async () => {
        const { item, runId } = await held("timeout-before-owner")
        await scene.expireClaims(runId)
        const entered = barrier()
        const proceed = barrier()
        const requested = barrier()
        const timeouts = world.resolve(AgentGraphWaitTimeoutService)
        const expire = timeouts.expire.bind(timeouts)
        jest.spyOn(timeouts, "expire").mockImplementationOnce(async (...args) => {
            entered.release()
            await proceed.promise
            return expire(...args)
        })
        const sweepTask = world.resolve(AgentRunSweepService).sweep()
        await entered.promise
        const items = world.resolve(WorkItemsService)
        const reopen = items.reopen.bind(items)
        jest.spyOn(items, "reopen").mockImplementationOnce((...args) => {
            const attempt = reopen(...args)
            requested.release()
            return attempt
        })
        const ownerTask = world
            .resolve(WorkEngineService)
            .resumeWork(ctx, item.id, "approved", {}, await owner())
            .then(
                () => null,
                (error: unknown) => error,
            )
        await requested.promise
        proceed.release()
        await sweepTask
        expect(await ownerTask).toMatchObject({ code: "WORK_PERFORMERS_APPROVAL_INVALID" })
        const approval = await soleStepOfKind(world, scene.workspaceId, runId, "approval")
        expect(approval.result).toMatchObject({ approved: false })
        expect((await world.resolve(DecisionLogReadService).decidersOf([item.id])).has(item.id)).toBe(false)
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).length).toBe(0)
    })

    it("rolls item close and decision actor back together when the decision transaction aborts", async () => {
        const { item, runId } = await held("output-close-rollback")
        const recorder = world.resolve(WorkRecorderService)
        const record = recorder.recordFinished.bind(recorder)
        const aborted = new DecisionsError({ code: DecisionsErrorCode.NotFound })
        jest.spyOn(recorder, "recordFinished").mockImplementationOnce(async (...args) => {
            await record(...args)
            throw aborted
        })
        await expect(
            world.resolve(WorkEngineService).resumeWork(ctx, item.id, "approved", {}, await owner()),
        ).rejects.toBe(aborted)
        expect((await world.resolve(DecisionLogReadService).decidersOf([item.id])).has(item.id)).toBe(false)
        expect((await world.resolve(WorkItemsService).findMany([item.id], 1))[0]?.status).not.toBe("done")
        expect(
            (await world.resolve(AgentRunTraceService).stepsOf(scene.workspaceId, runId)).filter(
                (step) => step.kind === "output",
            ),
        ).toHaveLength(0)
    })
})

describe("output delivery: real database receipts", () => {
    it("stores one website reply under its work item and replays the stored body", async () => {
        const { item } = await held("website-reply")
        const delivery = world.resolve(CustomerDeliveryService)
        expect(await delivery.finalInConversation(scene.workspaceId, conversationId, "Original reply", item.id)).toBe(
            "acknowledged",
        )
        expect(await delivery.finalInConversation(scene.workspaceId, conversationId, "Changed retry", item.id)).toBe(
            "acknowledged",
        )
        const rows = await em().find(MessageEntity, { where: { id: item.id, conversationId }, take: 2 })
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ body: "Original reply", deliveryStatus: "sent" })
    })

    it("grants one concurrent send and leaves a killed attempt fenced for reconciliation", async () => {
        const messages = world.resolve(AgentMessagesService)
        const messageId = await messages.storeAgentMessage(scene.workspaceId, conversationId, "One external reply")
        const attempts = await Promise.all([
            messages.claimDelivery(messageId, conversationId),
            messages.claimDelivery(messageId, conversationId),
        ])
        expect(attempts.sort()).toEqual(["ambiguous", "send"])
        await setOutputProofChannel(em(), conversationId, true)
        try {
            expect(
                await world
                    .resolve(ChannelDeliveryService)
                    .deliver({ conversationId, messageId, text: "One external reply" }),
            ).toMatchObject({ outcome: "ambiguous", delivered: false })
            expect(await em().findOneByOrFail(MessageEntity, { id: messageId })).toMatchObject({
                deliveryStatus: "failed",
                deliveryError: "delivery_outcome_unknown",
            })
        } finally {
            await setOutputProofChannel(em(), conversationId, false)
        }
    })
})

describe("output approval: published graph stop interleaving", () => {
    it("commits stop rejection, its decision and declined wait together before a later owner click", async () => {
        const { item, runId } = await held("graph-stop-before-owner")
        await persistOutputGraphStop(
            em(),
            identity,
            {
                versionId: world.id(),
                requestId: world.id(),
                chainStepId: world.id(),
            },
            item.id,
        )
        await scene.expireClaims(runId)
        const entered = barrier()
        const proceed = barrier()
        const timeouts = world.resolve(AgentGraphWaitTimeoutService)
        const expire = timeouts.expire.bind(timeouts)
        jest.spyOn(timeouts, "expire").mockImplementationOnce(async (...args) => {
            entered.release()
            await proceed.promise
            return expire(...args)
        })
        const sweepTask = world.resolve(AgentRunSweepService).sweep()
        await entered.promise
        const requested = barrier()
        const items = world.resolve(WorkItemsService)
        const reopen = items.reopen.bind(items)
        jest.spyOn(items, "reopen").mockImplementationOnce((...args) => {
            const task = reopen(...args)
            requested.release()
            return task
        })
        const ownerTask = world
            .resolve(WorkEngineService)
            .resumeWork(ctx, item.id, "approved", {}, await owner())
            .then(
                () => null,
                (error: unknown) => error,
            )
        await requested.promise
        proceed.release()
        await sweepTask
        expect(await ownerTask).toMatchObject({ code: "DECISIONS_NOT_WAITING" })
        expect((await world.resolve(WorkItemsService).findMany([item.id], 1))[0]?.status).toBe("rejected")
        expect((await soleStepOfKind(world, scene.workspaceId, runId, "approval")).result).toMatchObject({
            approved: false,
        })
        expect((await em().findOneByOrFail(GraphDecisionEntity, { workItemId: item.id })).closedAs).toBe("rejected")
        expect((await stepRecordsOfKind(world, scene.workspaceId, runId, "output")).length).toBe(0)
        expect((await world.resolve(DecisionLogReadService).decidersOf([item.id])).has(item.id)).toBe(true)
    })
})

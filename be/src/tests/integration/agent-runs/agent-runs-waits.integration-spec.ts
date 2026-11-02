import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import { WorkItemsService } from "@modules/domain/work-items"
import { DecisionLogReadService, WorkRecorderService } from "@modules/domain/decisions"
import { agentRunsEntities } from "@modules/domain/agent-runs"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { AgentRunSweepService } from "../../../modules/domain/agent-runs/agent-run-sweep.service"
import { AgentRunItemClosedService } from "../../../modules/domain/agent-runs/agent-run-item-closed.service"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { AgentStepJobService } from "../../../modules/domain/agent-runs/agent-step-job.service"
import {
    commitWaitsDecision,
    persistWaitsAsk,
    persistWaitsFixture,
    persistWaitsItem,
} from "../../fixtures/builders/agent-runs-waits.builder"
import type { WaitsFixtureBranch } from "../../fixtures/builders/agent-runs-waits.builder"
import { useTestWorld } from "../../world/use-test-world"
import { WAIT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { WaitsExtensionActivity, waitsExtensionStep } from "../../world/agent-runs-waits.module"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { sceneOf } from "@tests/world/agent-runs-scene.service"

const world = useTestWorld({ modules: WAIT_RUNS_MODULES })
const scene = sceneOf(world)
const [, StepEntity] = agentRunsEntities
const [, , , , GraphDecisionEntity] = agentGraphsEntities
const [ApprovalRequestEntity] = approvalRequestsEntities
const [MemberEntity] = workspaceMembersEntities
const who = {
    workspaceId: scene.workspaceId,
    agentId: scene.agentId,
    installationId: world.id(),
    versionId: world.id(),
    ruleId: world.id(),
}
const activity = () => world.resolve(WaitsExtensionActivity)
const items = () => world.resolve(WorkItemsService)
const runs = () => world.resolve(AgentRunsService)
const SIGNAL = new AbortController().signal
const em = () => world.db.primary
const HOUR_MS = 3_600_000
const after = (ms: number): Date => new Date(world.resolve<Clock>(CLOCK).now().getTime() + ms)

beforeAll(() => persistWaitsFixture(em(), who))
beforeEach(() => activity().reset())

const statuses = async (runId: string): Promise<ReadonlyArray<string>> =>
    (await scene.stepsOf(runId)).map((step) => `${step.stepKey}:${step.status}`)

/** An extension step waiting on a real owner row, with the persisted wake in every branch input. */
const askingRun = async (
    label: string,
    deadline: Date,
    options: { readonly plain?: boolean; readonly branch?: WaitsFixtureBranch; readonly sibling?: boolean } = {},
) => {
    const item = await persistWaitsItem(items(), who, world.key(label))
    if (item === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
    const scened = await scene.newRun(label, [])
    const requestId = world.id()
    if (options.branch !== undefined) {
        await persistWaitsAsk(em(), who, item.id, { requestId, chainStepId: world.id() }, options.branch)
    }
    const ask = waitsExtensionStep("ask", options.plain === true ? "deadline" : "approval", {
        itemId: item.id,
        wakeId: scened.wakeId,
        deadlineAt: deadline.toISOString(),
    })
    await em().transaction((tx) =>
        runs().append(tx, scened.runId, [
            ask,
            ...(options.sibling === true ? [waitsExtensionStep("door", "door", { wakeId: scened.wakeId })] : []),
        ]),
    )
    await runs().advance(scened.runId, SIGNAL)
    return { ...scened, item, itemId: item.id, requestId }
}

const closeOwnerItem = (item: Awaited<ReturnType<typeof persistWaitsItem>>, approved: boolean) => {
    if (item === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
    return commitWaitsDecision(em(), items(), world.resolve(WorkRecorderService), who, item, approved)
}

const recordedActor = async (itemId: string) =>
    (await world.resolve(DecisionLogReadService).decidersOf([itemId])).get(itemId)

describe("agent-runs/wait-timeout: an extension wait passes its deadline with no answer", () => {
    it("agent-runs/wait-timeout: the real graph ends silence and the extension without a decision handler stops visibly", async () => {
        const { runId, itemId } = await askingRun("wait-silence", after(-1000), { plain: true, branch: "silence" })
        expect((await scene.runRow(runId)).status).toBe("waiting")

        await world.resolve(AgentRunSweepService).sweep()

        expect(await em().findOneByOrFail(GraphDecisionEntity, { workItemId: itemId })).toMatchObject({
            closedAs: "expired",
        })
        expect((await scene.runRow(runId)).status).toBe("dead")
        expect((await scene.runRow(runId)).errorCode).toBe("wait_timeout")
        expect(activity().told).toEqual(["ask:wait_timeout"])
        expect(await statuses(runId)).toEqual(["ask:failed"])
        expect((await items().findMany([itemId], 1))[0]?.status).toBe("waiting_decision")

        await world.resolve(AgentRunSweepService).sweep()

        expect(activity().told).toEqual(["ask:wait_timeout"])
        expect(await em().count(GraphDecisionEntity, { where: { workItemId: itemId, closedAs: "expired" } })).toBe(1)
    })

    it("agent-runs/wait-timeout: a real backup request keeps the wait under its new deadline", async () => {
        const { runId, itemId, requestId } = await askingRun("wait-backup", after(-1000), {
            plain: true,
            branch: "backup",
        })

        await world.resolve(AgentRunSweepService).sweep()
        const renewed = await em().findOneByOrFail(GraphDecisionEntity, { workItemId: itemId })
        const request = await em().findOneByOrFail(ApprovalRequestEntity, { id: renewed.approvalRequestId ?? "" })
        const step = await em().findOneByOrFail(StepEntity, { runId, stepKey: "ask" })
        const owner = await em().findOneByOrFail(MemberEntity, { workspaceId: scene.workspaceId, role: "owner" })
        await world.resolve(AgentRunSweepService).sweep()

        expect(renewed.approvalRequestId).not.toBe(requestId)
        expect(renewed.closedAs).toBeNull()
        expect(request).toMatchObject({
            workspaceId: scene.workspaceId,
            requestedByAgentId: scene.agentId,
            status: "pending",
        })
        expect(request.approvers.map((member) => member.role)).toEqual(["owner"])
        expect(request.approvers.map((member) => member.memberId)).toEqual([owner.id])
        expect(step.claimUntil?.getTime()).toBeGreaterThan(after(HOUR_MS).getTime())
        expect((await em().findOneByOrFail(GraphDecisionEntity, { workItemId: itemId })).approvalRequestId).toBe(
            request.id,
        )
        expect((await scene.runRow(runId)).status).toBe("waiting")
        expect(await statuses(runId)).toEqual(["ask:running"])
        expect(activity().told).toEqual([])
    })
})

describe("agent-runs/wait-answer: a person answers the real work item", () => {
    it("agent-runs/wait-answer: the persisted answer finishes the wait and writes its next step and job once", async () => {
        const { runId, item, itemId, wakeId } = await askingRun("wait-answer", after(HOUR_MS))
        const by = await closeOwnerItem(item, true)
        const closed = world.resolve(AgentRunItemClosedService)
        await closed.closed(scene.workspaceId, itemId, "approved", by.memberId)
        await closed.closed(scene.workspaceId, itemId, "approved", by.memberId)

        expect(await statuses(runId)).toEqual(["ask:done", "reply:pending"])
        expect((await scene.stepsOf(runId))[0]?.result).toEqual({ approved: true, by: by.memberId })
        expect(await recordedActor(itemId)).toBe(by.memberId)
        expect(
            (await scene.jobs()).filter((job) => job.dedupeKey === `agent-step:${runId}:${itemId}:resume`),
        ).toHaveLength(1)

        const job = world.resolve(AgentStepJobService)
        await job.run({ workspaceId: scene.workspaceId, runId })
        await job.run({ workspaceId: scene.workspaceId, runId })

        expect(await statuses(runId)).toEqual(["ask:done", "reply:done"])
        expect(activity().performed).toEqual([`reply:${wakeId}`])
        expect((await scene.runRow(runId)).status).toBe("done")
        expect((await items().findMany([itemId], 1))[0]?.status).toBe("done")
    })

    it("agent-runs/wait-answer: an answer for an unrelated item changes nothing", async () => {
        const { runId } = await askingRun("wait-other", after(HOUR_MS))

        const resumed = await em().transaction((tx) =>
            runs().resumeWaiting(tx, world.id(), { approved: true, by: null }),
        )

        expect(resumed).toBe(false)
        expect(await statuses(runId)).toEqual(["ask:running"])
        expect(activity().performed).toEqual([])
    })
})

describe("agent-runs/wait-branch: a wait parks only its own branch", () => {
    it("agent-runs/wait-branch: ready siblings finish past an open approval and the owner's rejection finishes the wait", async () => {
        const { runId, wakeId, item, itemId } = await askingRun("wait-branch", after(HOUR_MS), { sibling: true })

        expect(await statuses(runId)).toEqual(["ask:running", "door:done", "tool:done", "reply:done"])
        expect((await scene.runRow(runId)).status).toBe("waiting")
        expect(activity().performed).toEqual([`door:${wakeId}`, `tool:${wakeId}`, `reply:${wakeId}`])

        const by = await closeOwnerItem(item, false)
        await world.resolve(AgentRunItemClosedService).closed(scene.workspaceId, itemId, "rejected", by.memberId)

        expect((await scene.runRow(runId)).status).toBe("done")
        expect((await items().findMany([itemId], 1))[0]?.status).toBe("rejected")
        expect((await scene.stepsOf(runId))[0]?.result).toEqual({ approved: false, by: by.memberId })
        expect(await recordedActor(itemId)).toBe(by.memberId)
        expect(activity().performed).toEqual([`door:${wakeId}`, `tool:${wakeId}`, `reply:${wakeId}`])
    })
})

describe("agent-runs/kill-after-approval: the callback is lost after the owner transaction committed", () => {
    it("agent-runs/kill-after-approval: the sweep reads the actual approved row and actor, then finishes the reply once", async () => {
        const { runId, item, itemId, wakeId } = await askingRun("kill-after-approval", after(-1000), {
            branch: "silence",
        })
        const by = await closeOwnerItem(item, true)

        expect(await statuses(runId)).toEqual(["ask:running"])
        expect(await recordedActor(itemId)).toBe(by.memberId)
        await world.resolve(AgentRunSweepService).sweep()
        const job = world.resolve(AgentStepJobService)
        await job.run({ workspaceId: scene.workspaceId, runId })
        await job.run({ workspaceId: scene.workspaceId, runId })

        expect(await statuses(runId)).toEqual(["ask:done", "reply:done"])
        expect((await scene.stepsOf(runId))[0]?.result).toEqual({ approved: true, by: by.memberId })
        expect(activity().performed).toEqual([`reply:${wakeId}`])
        expect(activity().told).toEqual([])
        expect((await items().findMany([itemId], 1))[0]?.status).toBe("done")
        expect((await em().findOneByOrFail(GraphDecisionEntity, { workItemId: itemId })).closedAs).toBeNull()
    })
})

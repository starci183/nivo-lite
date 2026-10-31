import assert from "node:assert/strict"
import { AgentWorkSweepService } from "../../../modules/domain/agent-schedules"
import { AgentTriggerSyncService } from "../../../modules/domain/agent-schedules/agent-trigger-sync.service"
import {
    AgentDrainService,
    AgentTriggersService,
    AgentTurnsService,
    AgentWakeService,
} from "../../../modules/domain/agent-work"
import type { AgentTurnView, AgentWakeSource } from "../../../modules/domain/agent-work/agent-work.contracts"
import { QUEUE_SCHEDULES } from "@modules/platform/queue"
import type { QueueDelivery, QueueSchedules } from "@modules/platform/queue"
import { AGENT_SCHEDULE_FIRE_JOB, AGENT_SCHEDULE_FIRE_QUEUE, agentTriggerSchedulerId } from "@modules/queues/agent-turn"
import { agentWakeOf, dueTaskOf } from "../../fixtures/builders/agent-work.builder"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { RoadWork, agentRoadModules } from "../../world/agent-road-capabilities.options"
import { lateTrigger, sweepDrainsOf, wakesOfSource } from "../../world/agent-road-database.service"
import { lapseLease, removeDrainJobs, settleAgentWork, turnsOfWake, wakeOfFact } from "../../world/agent-work-database.service"
import { worldIds } from "../../world/lite-world.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { transportOf, waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: agentRoadModules(`agent-road-${worldIds.next()}`) })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const AGENT = identity.agents.care

const em = () => world.db.primary
const road = () => world.resolve(RoadWork)
const schedules = () => world.resolve<QueueSchedules>(QUEUE_SCHEDULES)

const post = (eventKey: string, source: AgentWakeSource, context: AgentTurnView["context"]) =>
    em().transaction((tx) =>
        world.resolve(AgentWakeService).wake(
            tx,
            agentWakeOf({
                workspaceId: WS,
                agentId: AGENT,
                source,
                eventKey: `${world.prefix}:${eventKey}`,
                context,
                actorMemberId: null,
            }),
        ),
    )

const drain = () => world.resolve(AgentDrainService).drain({ workspaceId: WS, agentId: AGENT, scopeKey: "agent" })

const wakeOf = (source: AgentWakeSource, eventKey: string) =>
    wakeOfFact(em(), AGENT, source, `${world.prefix}:${eventKey}`)

beforeAll(async () => {
    world.cleanup(async () => {
        await removeDrainJobs(em(), WS)
        await removeWorkspace(em(), WS)
        await removeAuthUsers(em(), Object.values(identity.users))
    })
    await persistOfficeRows(em(), identity)
})

beforeEach(() => {
    road().ran.length = 0
})

afterEach(() => settleAgentWork(em(), WS))

describe("agent-work/road: the clock", () => {
    it("agent-work/scheduler-fires-once: two workers on one fire queue handle each slot once, and a removed scheduler stops", async () => {
        const queue = `fires-${world.prefix}`
        const id = agentTriggerSchedulerId(world.id())
        const seen: Array<string> = []
        const handler = {
            queue,
            job: AGENT_SCHEDULE_FIRE_JOB,
            scheduled: true,
            handle: (delivery: QueueDelivery) => {
                seen.push(delivery.id)
                return Promise.resolve()
            },
        }
        await transportOf(world).workFires(handler, 1)
        await transportOf(world).workFires(handler, 1)

        await transportOf(world).schedule(queue, id, { pattern: "* * * * * *", tz: "UTC" }, AGENT_SCHEDULE_FIRE_JOB, {})
        await waitForProof(
            () => Promise.resolve(seen.length),
            (count) => count >= 3,
            15_000,
        )
        await transportOf(world).unschedule(queue, id)

        expect(new Set(seen).size).toBe(seen.length)
        const settled = seen.length
        await transportOf(world).wait(2500)
        expect(seen.length).toBeLessThanOrEqual(settled + 1)
    })

    it("agent-work/scheduler-recovered: with Redis lost, the sweep makes the scheduler again and wakes for the missed slot once", async () => {
        const triggers = world.resolve(AgentTriggersService)
        const trigger = await triggers.save(null, {
            workspaceId: WS,
            agentId: AGENT,
            triggerId: null,
            kind: "schedule",
            preset: "hourly",
            atTime: null,
            timeZone: null,
            eventName: null,
            probeKey: null,
            enabled: true,
        })
        const schedulerId = agentTriggerSchedulerId(trigger.id)
        await expect(world.resolve(AgentTriggerSyncService).reconcile(WS, trigger)).resolves.toBeInstanceOf(Date)

        await schedules().unschedule(AGENT_SCHEDULE_FIRE_QUEUE, schedulerId)
        expect(await schedules().nextOf(AGENT_SCHEDULE_FIRE_QUEUE, schedulerId)).toBeNull()
        await lateTrigger(em(), trigger.id, 10)

        const sweep = world.resolve(AgentWorkSweepService)
        expect((await sweep.sweep()).missed).toBeGreaterThanOrEqual(1)
        await sweep.sweep()

        expect(await schedules().nextOf(AGENT_SCHEDULE_FIRE_QUEUE, schedulerId)).toBeInstanceOf(Date)
        expect(await wakesOfSource(em(), AGENT, "schedule")).toBe(1)
        await schedules().unschedule(AGENT_SCHEDULE_FIRE_QUEUE, schedulerId)
    })
})

describe("agent-work/road: the work", () => {
    it("agent-work/no-work-no-model: a schedule whose probe finds nothing is skipped with no model call, and runs once there is work", async () => {
        await post("quiet", "schedule", { probeKey: "tasks_due" })
        await drain()
        expect(await wakeOf("schedule", "quiet")).toMatchObject({ status: "skipped", reason: "no_work" })
        expect(road().ran).toHaveLength(0)

        await dueTaskOf(em(), WS, AGENT, world.key("chase"))
        await post("busy", "schedule", { probeKey: "tasks_due" })
        await drain()
        expect(await wakeOf("schedule", "busy")).toMatchObject({ status: "done" })
        expect(road().ran).toHaveLength(1)
    })

    it("agent-work/crash-resume: a turn whose worker died is driven by the sweep and served once by the next drain", async () => {
        await post("crash", "internal", { taskId: world.id() })
        const dead = await world.resolve(AgentTurnsService).begin(AGENT, "agent", "worker-dead")
        assert(dead.result === "begun")
        await lapseLease(em(), AGENT, "agent")

        await world.resolve(AgentWorkSweepService).sweep()
        expect(await sweepDrainsOf(em(), WS, AGENT, "agent")).toHaveLength(1)

        await drain()
        expect(await wakeOf("internal", "crash")).toMatchObject({ status: "done" })
        expect(road().ran).toEqual([dead.turn.wakeId])
        const turns = await turnsOfWake(em(), dead.turn.wakeId)
        expect(turns).toHaveLength(2)
        expect(turns[0]?.status).toBe("abandoned")
    })
})

import { jobsEntities } from "@modules/platform/jobs"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { ScriptedWorld, chainFrom } from "../../world/agent-runs-script.service"
import { sceneOf } from "../../world/agent-runs-scene.service"
import { useTestWorld } from "../../world/use-test-world"

const JobOutboxEntity: (typeof jobsEntities)[1] = jobsEntities[1]

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const scene = sceneOf(world)

const SIGNAL = new AbortController().signal
const em = () => world.db.primary

beforeEach(() => world.resolve(ScriptedWorld).reset())

/** The payloads of the declared jobs of one name the workspace holds in the outbox. */
const deliveriesOf = async (job: string): Promise<ReadonlyArray<Readonly<Record<string, unknown>>>> => {
    const rows = await em().find(JobOutboxEntity, { where: { workspaceId: scene.workspaceId }, take: 100 })
    return rows
        .flatMap((row) => (isRecord(row.payload) ? [row.payload] : []))
        .filter((payload) => payload["job"] === job)
}

describe("the report of a run that ended", () => {
    it("enqueues one declared report job, in the transaction of the final status, and none while the run goes on", async () => {
        const { runId, wakeId } = await scene.newRun("report-run")
        await em().transaction((tx) =>
            world
                .resolve(AgentRunsService)
                .append(scene.workspaceId, tx, runId, [chainFrom("door", wakeId), chainFrom("door", wakeId)]),
        )
        expect(await deliveriesOf("platform.post-report")).toEqual([])

        await eachInOrder([0, 1, 2, 3], () => world.resolve(AgentRunsService).advance(scene.workspaceId, runId, SIGNAL))

        const reports = await deliveriesOf("platform.post-report")
        expect(reports).toHaveLength(1)
        expect(reports[0]).toMatchObject({
            workspaceId: scene.workspaceId,
            job: "platform.post-report",
            input: { runId, agentId: scene.agentId },
        })
        await world.resolve(AgentRunsService).advance(scene.workspaceId, runId, SIGNAL)
        expect(await deliveriesOf("platform.post-report")).toHaveLength(1)
    })
})

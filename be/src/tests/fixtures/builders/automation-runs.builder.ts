import { builder } from "@starci/jest-preset"
import { automationRunsEntities } from "@modules/domain/automation-runs"

const [AutomationRunEntity] = automationRunsEntities
type AutomationRunEntity = InstanceType<typeof AutomationRunEntity>

/** The moment the automation run specs run at. */
const RUN_MOMENT = "2026-10-12T10:00:00.000Z"

/** A queued run of pipeline `p-1`, with the fields a spec rarely changes filled. */
export const runOf = builder<AutomationRunEntity>({
    id: "r-1",
    pipelineId: "p-1",
    workspaceId: "ws-1",
    triggerRef: "t-1",
    dedupeKey: "d-1",
    payload: {},
    status: "queued",
    steps: [],
    evidence: null,
    error: null,
    attempts: 0,
    runAt: new Date(RUN_MOMENT),
    createdAt: new Date(RUN_MOMENT),
    finishedAt: null,
})

/** A second queued run, id `r-2`. */
export const secondRun = (): AutomationRunEntity => runOf({ id: "r-2" })

/** A finished run of trigger `a`. */
export const doneRunOfTriggerA = (): AutomationRunEntity => runOf({ triggerRef: "a", status: "done" })

/** A run parked until an approval comes. */
export const runWaitingForApproval = (): AutomationRunEntity => runOf({ status: "waiting_approval" })

/** A queued run that carries the payload `{ x: 1 }`. */
export const runCarryingPayloadX = (): AutomationRunEntity => runOf({ payload: { x: 1 } })

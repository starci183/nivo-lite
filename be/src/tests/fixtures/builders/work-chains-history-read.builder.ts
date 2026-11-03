import { workChainsEntities } from "@modules/domain/work-chains"
import { entityOf } from "./entity.builder"

const WorkChainEntity: (typeof workChainsEntities)[0] = workChainsEntities[0]
type WorkChainEntity = InstanceType<typeof WorkChainEntity>

/** When the chain step of the history reads started. */
export const STEP_STARTED: Date = new Date("2026-10-11T03:00:00.000Z")

/** When the chain step of the history reads finished. */
export const STEP_FINISHED: Date = new Date("2026-10-12T03:00:00.000Z")

/** A finished, decided chain step row `c-1` of thread `t-1`, overridable. */
export const stepOf: (overrides?: Partial<WorkChainEntity>) => WorkChainEntity = entityOf(WorkChainEntity, {
    id: "c-1",
    threadId: "t-1",
    actorKind: "agent",
    actorId: "a-1",
    action: "hand_off",
    rule: null,
    decidedBy: "m-1",
    startedAt: STEP_STARTED,
    finishedAt: STEP_FINISHED,
})

/** Step `c-2`, which has started and not finished. */
export const unfinishedStepRow = (): WorkChainEntity => stepOf({ id: "c-2", finishedAt: null })

/** Step `c-3`, which nobody has decided. */
export const undecidedStepRow = (): WorkChainEntity => stepOf({ id: "c-3", decidedBy: null })

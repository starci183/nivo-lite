import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkBranchDecider } from "./branch-decider.port"

/** Token of the branch decider port: absent until the action graph binds one, and then the gate decides alone. */
export const WORK_BRANCH_DECIDER: unique symbol = Symbol("domain.authority-rules.work-branch-decider")

/** Injects the branch decider port. Parameter type: WorkBranchDecider. */
export const InjectWorkBranchDecider = (): TypedParameterDecorator<WorkBranchDecider> =>
    injector<WorkBranchDecider>(WORK_BRANCH_DECIDER)

import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkbenchDoorOptions } from "./workbench-door.options"
import type { WorkbenchApprovals } from "./workbench-door.port"

/** Token of the workbench door options, exported so a spec can provide it. */
export const WORKBENCH_DOOR_OPTIONS: unique symbol = Symbol("domain.workbench-door.options")

/** Injects the options of the workbench door. Parameter type: WorkbenchDoorOptions. */
export const InjectWorkbenchDoorOptions = (): TypedParameterDecorator<WorkbenchDoorOptions> =>
    injector<WorkbenchDoorOptions>(WORKBENCH_DOOR_OPTIONS)

/** Token of the port that opens an approval for an action the authority rules ask a person about. */
export const WORKBENCH_APPROVALS: unique symbol = Symbol("domain.workbench-door.approvals")

/** Injects the approvals port. Parameter type: WorkbenchApprovals. */
export const InjectWorkbenchApprovals = (): TypedParameterDecorator<WorkbenchApprovals> =>
    injector<WorkbenchApprovals>(WORKBENCH_APPROVALS)

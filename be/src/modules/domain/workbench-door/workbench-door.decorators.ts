import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkbenchDoorOptions } from "./workbench-door.options"

/** Token of the workbench door options, exported so a spec can provide it. */
export const WORKBENCH_DOOR_OPTIONS: unique symbol = Symbol("domain.workbench-door.options")

/** Injects the options of the workbench door. Parameter type: WorkbenchDoorOptions. */
export const InjectWorkbenchDoorOptions = (): TypedParameterDecorator<WorkbenchDoorOptions> =>
    injector<WorkbenchDoorOptions>(WORKBENCH_DOOR_OPTIONS)

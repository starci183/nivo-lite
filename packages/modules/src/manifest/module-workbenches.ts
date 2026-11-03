import type { WorkbenchDeclaration } from "@nivo/agent-sdk/workbench/contract"
import { LOYALTY_WORKBENCH } from "@nivo/module-loyalty/manifest"

/**
 * The workbench declaration of every module built on the SDK. The front end pairs each with how it draws (the module's component, or a
 * published spec version from the database) and reads nothing else of a module.
 */
export const MODULE_WORKBENCHES: ReadonlyArray<WorkbenchDeclaration> = [LOYALTY_WORKBENCH]

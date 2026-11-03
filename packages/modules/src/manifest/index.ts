import { specRegistryFrom } from "@nivo/agent-sdk/workbench/contract"
import type { WorkbenchDeclaration, WorkbenchSpecRegistry } from "@nivo/agent-sdk/workbench/contract"
import { LOYALTY_WORKBENCH } from "@nivo/module-loyalty/manifest"

/**
 * The workbench declaration of every module built on the SDK. The front end pairs each with how it draws (the module's component, or a
 * published spec version from the database) and reads nothing else of a module.
 */
export const MODULE_WORKBENCHES: ReadonlyArray<WorkbenchDeclaration> = [LOYALTY_WORKBENCH]

/**
 * Everything a stored spec may name: the SDK's blocks and each module's exposed blocks, reads and actions. The back end validates a
 * spec version against it before saving or publishing, and the front end again before drawing; both read this one build-time value.
 */
export const SPEC_REGISTRY: WorkbenchSpecRegistry = specRegistryFrom(MODULE_WORKBENCHES)

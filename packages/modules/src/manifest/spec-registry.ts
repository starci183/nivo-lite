import { specRegistryFrom } from "@nivo/agent-sdk/workbench/contract"
import type { WorkbenchSpecRegistry } from "@nivo/agent-sdk/workbench/spec"
import { MODULE_WORKBENCHES } from "./module-workbenches"

/**
 * Everything a stored spec may name: the SDK's blocks and each module's exposed blocks, reads and actions. The back end validates a
 * spec version against it before saving or publishing, and the front end again before drawing; both read this one build-time value.
 */
export const SPEC_REGISTRY: WorkbenchSpecRegistry = specRegistryFrom(MODULE_WORKBENCHES)

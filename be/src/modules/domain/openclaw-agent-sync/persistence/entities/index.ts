import { OpenclawAgentSyncEntity } from "./openclaw-agent-sync.entity"

export { OpenclawAgentSyncEntity }
export type { OpenclawSyncFileMeta } from "./openclaw-agent-sync.entity"

/** The entities of the openclaw-agent-sync capability, registered on the primary connection. */
export const openclawAgentSyncEntities = [OpenclawAgentSyncEntity] as const

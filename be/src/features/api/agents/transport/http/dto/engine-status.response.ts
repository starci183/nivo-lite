/** Whether the agent engine is usable, for the Agents page. */
export class EngineStatusResponse {
    /** True when a gateway address and credential are configured. */
    gatewayConfigured!: boolean
    /** True when the agent workspaces can be written. */
    workspaceWritable!: boolean
    /** The last time a sync of the workspace ran, ISO 8601, or null when none ever did. */
    lastSyncCheckAt!: string | null
    /** True when the last sync check is younger than the freshness window. */
    syncFresh!: boolean
}

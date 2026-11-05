/** What the app root tells the door provider: which per-workspace agent a declared job calls the NIVO MCP gateway as. */
export interface EntityEngineDoorOptions {
    /** The module key of the per-workspace agent whose grants decide what a declared job may call (its OpenClaw agent id is derived from it). */
    readonly agentModule: string
}

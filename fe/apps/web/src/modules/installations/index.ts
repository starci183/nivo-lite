export { allGatesConfirmed, gateEntry, gateHint, gateLabel, gatesOf, snapshotOf } from "./installations.gates"
export {
    agentDisplayName,
    cleanInstanceName,
    instanceNameKey,
    instancesOf,
    nextInstanceName,
    showsInstanceName,
} from "./installations.instances"
export { AGENT_STATUS_TONE, STATUS_FILTERS, agentStatusOf, foldText, isStatusFilter } from "./installations.status"
export type { StatusFilter } from "./installations.status"
export { AGENTS_ROUTE, agentHref, agentListHref, workbenchPath } from "./installations.routes"
export type { AgentTab } from "./installations.routes"
export type {
    ContextSnapshot,
    ContextVersion,
    DraftSnapshot,
    GateEntry,
    GateEvidence,
    GateStatus,
    Installation,
    InstallationStatus,
    OperatingMode,
    SetupFact,
    SetupMessage,
    SetupRevision,
    SetupSession,
    SettingsExtraProps,
} from "./installations.types"

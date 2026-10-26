export { allGatesConfirmed, gateEntry, gateHint, gateLabel, gatesOf, snapshotOf } from "./installations.gates"
export { cleanInstanceName, instanceNameKey, instancesOf, nextInstanceName } from "./installations.instances"
export {
    AGENT_STATUS_TONE,
    installationPersonName,
    agentLifecycleOf,
    agentLifecycleTone,
    agentSubtitleOf,
    agentStatusOf,
    foldText,
    installationLifecycleOf,
} from "./installations.status"
export type { AgentLifecycle } from "./installations.status"
export { agentHref, agentListHref } from "./installations.routes"
export type { AgentTab } from "./installations.routes"
export type {
    ContextVersion,
    GateEntry,
    GateEvidence,
    GateStatus,
    Installation,
    InstallationConnectionNeed,
    InstallationStatus,
    OperatingMode,
    SetupFact,
    SetupMessage,
    SetupRevision,
    SetupSession,
} from "./installations.types"

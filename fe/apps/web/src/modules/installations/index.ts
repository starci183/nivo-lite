export { allGatesConfirmed, gateEntry, gateHint, gateLabel, gatesOf, snapshotOf } from "./installations.gates"
export { cleanInstanceName, instanceNameKey, instancesOf, nextInstanceName } from "./installations.instances"
export {
    displayNameOf,
    installationPersonName,
    agentLifecycleOf,
    agentLifecycleTone,
    agentSubtitleOf,
    isSetupPending,
    setupLabelKey,
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
    InstallationLifecycle,
    InstallationStatus,
    OperatingMode,
    SetupFact,
    SetupMessage,
    SetupProgress,
    SetupRevision,
    SetupSession,
} from "./installations.types"

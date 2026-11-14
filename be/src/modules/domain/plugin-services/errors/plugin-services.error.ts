import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the plugin services capability. */
export enum PluginServicesErrorCode {
    /** The agent is no installed agent of the workspace (or its installation was removed): there is no module to find a service in. */
    AgentUnknown = "PLUGIN_SERVICES_AGENT_UNKNOWN",
    /** No installed plugin ships a service of the contract for the module of the agent. */
    ServiceMissing = "PLUGIN_SERVICES_SERVICE_MISSING",
    /** The caller's transaction is of another workspace, or acts for no agent or another agent than the scope names. */
    ScopeMismatch = "PLUGIN_SERVICES_SCOPE_MISMATCH",
}

/** How each plugin services code travels. */
export const PLUGIN_SERVICES_ERROR_KINDS: Record<PluginServicesErrorCode, ErrorKind> = {
    [PluginServicesErrorCode.AgentUnknown]: "not-found",
    [PluginServicesErrorCode.ServiceMissing]: "not-found",
    [PluginServicesErrorCode.ScopeMismatch]: "internal",
}

/** The one error class of the plugin services capability. */
export class PluginServicesError extends DomainError<PluginServicesErrorCode> {}

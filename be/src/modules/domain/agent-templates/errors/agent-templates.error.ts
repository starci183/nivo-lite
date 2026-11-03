import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-templates capability. */
export enum AgentTemplatesErrorCode {
    /** No template has this key. */
    TemplateNotFound = "AGENT_TEMPLATES_TEMPLATE_NOT_FOUND",
    /** The template has no such version. */
    VersionNotFound = "AGENT_TEMPLATES_VERSION_NOT_FOUND",
    /** Another account already owns this template key. */
    KeyTaken = "AGENT_TEMPLATES_KEY_TAKEN",
    /** The template belongs to another account. */
    NotYours = "AGENT_TEMPLATES_NOT_YOURS",
    /** The package leaks something or does not hold together, so it is not made. */
    PackageRefused = "AGENT_TEMPLATES_PACKAGE_REFUSED",
    /** A value the buyer gave does not fit its parameter. */
    ValuesRefused = "AGENT_TEMPLATES_VALUES_REFUSED",
    /** The workspace has this kind of agent already, and the kind allows only one. */
    BaseAgentExists = "AGENT_TEMPLATES_BASE_AGENT_EXISTS",
    /** The graph holds branches of a template another account made, which cannot be packaged again. */
    ForeignTemplate = "AGENT_TEMPLATES_FOREIGN_TEMPLATE",
    /** The version to package does not belong to the agent. */
    GraphVersionNotFound = "AGENT_TEMPLATES_GRAPH_VERSION_NOT_FOUND",
    /** The installation was not made from a template. */
    NotATemplateInstall = "AGENT_TEMPLATES_NOT_A_TEMPLATE_INSTALL",
}

/** How each agent-templates code travels. */
export const AGENT_TEMPLATES_ERROR_KINDS: Record<AgentTemplatesErrorCode, ErrorKind> = {
    [AgentTemplatesErrorCode.TemplateNotFound]: "not-found",
    [AgentTemplatesErrorCode.VersionNotFound]: "not-found",
    [AgentTemplatesErrorCode.KeyTaken]: "conflict",
    [AgentTemplatesErrorCode.NotYours]: "forbidden",
    [AgentTemplatesErrorCode.PackageRefused]: "invalid",
    [AgentTemplatesErrorCode.ValuesRefused]: "invalid",
    [AgentTemplatesErrorCode.BaseAgentExists]: "conflict",
    [AgentTemplatesErrorCode.ForeignTemplate]: "forbidden",
    [AgentTemplatesErrorCode.GraphVersionNotFound]: "not-found",
    [AgentTemplatesErrorCode.NotATemplateInstall]: "not-found",
}

/** The one error class of the agent-templates capability. */
export class AgentTemplatesError extends DomainError<AgentTemplatesErrorCode> {}

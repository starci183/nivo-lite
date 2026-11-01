import { MODULE_CONTEXT_NOTES_ERROR_KINDS } from "@modules/domain/module-context-notes"
import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the modules capability. */
export enum ModulesErrorCode {
    /** The catalogue has no module with the requested key. */
    NotFound = "MODULES_NOT_FOUND",
    /** The catalogue breaks one of its own rules and must not be written to the database. */
    CatalogInvalid = "MODULES_CATALOG_INVALID",
    /** A default rule grants an action public.authority_actions does not hold: the catalogue was not synced. */
    CatalogUnresolved = "MODULES_CATALOG_UNRESOLVED",
    /** The name of an instance needs 1 to 80 characters. */
    InstanceNameInvalid = "MODULES_INSTANCE_NAME_INVALID",
    /** Another instance of the type already has this name. */
    InstanceNameTaken = "MODULES_INSTANCE_NAME_TAKEN",
    /** The type allows one instance per workspace. */
    SingleInstanceOnly = "MODULES_SINGLE_INSTANCE_ONLY",
    /** The installation is not one of the workspace. */
    InstallationNotFound = "MODULES_INSTALLATION_NOT_FOUND",
    /** The installation has no agent row. */
    AgentMissing = "MODULES_AGENT_MISSING",
    /** The display name of the agent is outside its limits. */
    AgentNameInvalid = "MODULES_AGENT_NAME_INVALID",
    /** The installation was removed: it only keeps its history. */
    InstallationRemoved = "MODULES_INSTALLATION_REMOVED",
    /** Going live needs an applied context version. */
    NeedsVersion = "MODULES_NEEDS_VERSION",
    /** A setting name or value is outside its limits. */
    SettingInvalid = "MODULES_SETTING_INVALID",
    /** Applying needs every gate confirmed. */
    GatesUnconfirmed = "MODULES_GATES_UNCONFIRMED",
    /** The draft equals the version in use. */
    SetupUnchanged = "MODULES_SETUP_UNCHANGED",
    /** The setup session is not an open draft. */
    SetupSessionClosed = "MODULES_SETUP_SESSION_CLOSED",
    /** The gate is not one of the module. */
    GateUnknown = "MODULES_GATE_UNKNOWN",
    /** A gate needs some evidence to be confirmed. */
    GateEmpty = "MODULES_GATE_EMPTY",
    /** The confirm card is not one of the workspace. */
    CardNotFound = "MODULES_CARD_NOT_FOUND",
    /** The confirm card was decided already. */
    CardDecided = "MODULES_CARD_DECIDED",
    /** A fact needs a subject, an attribute and a value. */
    CardFactIncomplete = "MODULES_CARD_FACT_INCOMPLETE",
    /** A different value is in force: the owner must choose what to do with it. */
    CardNeedsResolution = "MODULES_CARD_NEEDS_RESOLUTION",
    /** Keeping both values needs the situation of the new one. */
    CardNeedsSituation = "MODULES_CARD_NEEDS_SITUATION",
    /** A branch needs the band its boundary amount belongs to and the person asked above the line. */
    CardBranchIncomplete = "MODULES_CARD_BRANCH_INCOMPLETE",
    /** The flow of the agent still has a vague place, so the setup cannot be applied. */
    GraphGapsOpen = "MODULES_GRAPH_GAPS_OPEN",
    /** The brain held the fact for review instead of applying it. */
    CardFactNotApplied = "MODULES_CARD_FACT_NOT_APPLIED",
    /** The confirmed rule names an action outside the authority registry. */
    CardRuleUnknownAction = "MODULES_CARD_RULE_UNKNOWN_ACTION",
    /** The confirmed rule runs an action by itself past its cap. */
    CardRuleModeCapped = "MODULES_CARD_RULE_MODE_CAPPED",
    /** A turn of the setup chat failed in a way that heals (gateway, model, empty answer): the queue attempts it again. */
    SetupTurnTransient = "MODULES_SETUP_TURN_TRANSIENT",
}

/** How each modules code travels. */
export const MODULES_ERROR_KINDS: Record<ModulesErrorCode, ErrorKind> = {
    ...MODULE_CONTEXT_NOTES_ERROR_KINDS,
    [ModulesErrorCode.NotFound]: "not-found",
    [ModulesErrorCode.CatalogInvalid]: "internal",
    [ModulesErrorCode.CatalogUnresolved]: "internal",
    [ModulesErrorCode.InstanceNameInvalid]: "invalid",
    [ModulesErrorCode.InstanceNameTaken]: "conflict",
    [ModulesErrorCode.SingleInstanceOnly]: "invalid",
    [ModulesErrorCode.InstallationNotFound]: "not-found",
    [ModulesErrorCode.AgentMissing]: "not-found",
    [ModulesErrorCode.AgentNameInvalid]: "invalid",
    [ModulesErrorCode.InstallationRemoved]: "conflict",
    [ModulesErrorCode.NeedsVersion]: "invalid",
    [ModulesErrorCode.SettingInvalid]: "invalid",
    [ModulesErrorCode.GatesUnconfirmed]: "invalid",
    [ModulesErrorCode.SetupUnchanged]: "invalid",
    [ModulesErrorCode.SetupSessionClosed]: "not-found",
    [ModulesErrorCode.GateUnknown]: "invalid",
    [ModulesErrorCode.GateEmpty]: "invalid",
    [ModulesErrorCode.CardNotFound]: "not-found",
    [ModulesErrorCode.CardDecided]: "conflict",
    [ModulesErrorCode.CardFactIncomplete]: "invalid",
    [ModulesErrorCode.CardNeedsResolution]: "invalid",
    [ModulesErrorCode.CardNeedsSituation]: "invalid",
    [ModulesErrorCode.CardBranchIncomplete]: "invalid",
    [ModulesErrorCode.GraphGapsOpen]: "conflict",
    [ModulesErrorCode.CardFactNotApplied]: "conflict",
    [ModulesErrorCode.CardRuleUnknownAction]: "invalid",
    [ModulesErrorCode.CardRuleModeCapped]: "invalid",
    [ModulesErrorCode.SetupTurnTransient]: "unavailable",
}

/** The one error class of the modules capability. */
export class ModulesError extends DomainError<ModulesErrorCode> {}

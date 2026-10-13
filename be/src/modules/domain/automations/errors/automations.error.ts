import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the automations capability. */
export enum AutomationsErrorCode {
    /** The template exists in the catalogue but nothing runs it yet. */
    ComingSoon = "AUTOMATIONS_COMING_SOON",
    /** A requirement of the template is missing (a module, a channel, a connection, a capability). */
    RequirementMissing = "AUTOMATIONS_REQUIREMENT_MISSING",
    /** The template sends no customer message, so it has no wording to save or propose. */
    NoMessage = "AUTOMATIONS_NO_MESSAGE",
    /** The wording is too short. */
    BodyTooShort = "AUTOMATIONS_BODY_TOO_SHORT",
    /** The wording uses a blank the template does not offer. */
    BodyUnknownVariable = "AUTOMATIONS_BODY_UNKNOWN_VARIABLE",
    /** The template does not write to Google. */
    GoogleNotUsed = "AUTOMATIONS_GOOGLE_NOT_USED",
    /** The Google account is not one of the workspace's. */
    GoogleAccountUnknown = "AUTOMATIONS_GOOGLE_ACCOUNT_UNKNOWN",
    /** "Send by itself" was not offered yet. */
    TrustNotOffered = "AUTOMATIONS_TRUST_NOT_OFFERED",
    /** The template cannot be run on demand. */
    RunNowUnavailable = "AUTOMATIONS_RUN_NOW_UNAVAILABLE",
    /** The pipeline is off; switch it on before running it. */
    PipelineOff = "AUTOMATIONS_PIPELINE_OFF",
    /** The run could not be queued. */
    RunNotQueued = "AUTOMATIONS_RUN_NOT_QUEUED",
    /** The pipeline that was just saved is not in the gallery. */
    NotSaved = "AUTOMATIONS_NOT_SAVED",
    /** A request named no change. */
    NothingToChange = "AUTOMATIONS_NOTHING_TO_CHANGE",
    /** The authority gate could not send the message; the cause says why. */
    MessageNotSent = "AUTOMATIONS_MESSAGE_NOT_SENT",
    /** A port another capability has to bind is not bound yet. */
    PortPending = "AUTOMATIONS_PORT_PENDING",
}

/** How each automations code travels. */
export const AUTOMATIONS_ERROR_KINDS: Record<AutomationsErrorCode, ErrorKind> = {
    [AutomationsErrorCode.ComingSoon]: "invalid",
    [AutomationsErrorCode.RequirementMissing]: "conflict",
    [AutomationsErrorCode.NoMessage]: "invalid",
    [AutomationsErrorCode.BodyTooShort]: "invalid",
    [AutomationsErrorCode.BodyUnknownVariable]: "invalid",
    [AutomationsErrorCode.GoogleNotUsed]: "invalid",
    [AutomationsErrorCode.GoogleAccountUnknown]: "not-found",
    [AutomationsErrorCode.TrustNotOffered]: "conflict",
    [AutomationsErrorCode.RunNowUnavailable]: "invalid",
    [AutomationsErrorCode.PipelineOff]: "conflict",
    [AutomationsErrorCode.RunNotQueued]: "unavailable",
    [AutomationsErrorCode.NotSaved]: "internal",
    [AutomationsErrorCode.NothingToChange]: "invalid",
    [AutomationsErrorCode.MessageNotSent]: "unavailable",
    [AutomationsErrorCode.PortPending]: "unavailable",
}

/** The one error class of the automations capability. */
export class AutomationsError extends DomainError<AutomationsErrorCode> {}

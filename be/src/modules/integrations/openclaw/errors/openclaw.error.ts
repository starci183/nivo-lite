import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the OpenClaw integration. */
export enum OpenclawErrorCode {
    /** A configuration value is out of range or not a ws or wss address. */
    ConfigInvalid = "OPENCLAW_CONFIG_INVALID",
    /** No gateway is configured: a chat turn takes the fallback path. */
    GatewayNotConfigured = "OPENCLAW_GATEWAY_NOT_CONFIGURED",
    /** The gateway refused a request; the method and the gateway code ride in the params. */
    GatewayRefused = "OPENCLAW_GATEWAY_REFUSED",
    /** The gateway is still starting and asked to retry the connect later; `retryAfterMs` rides in the params. */
    GatewayDeferred = "OPENCLAW_GATEWAY_DEFERRED",
    /** The gateway did not answer within the turn deadline. */
    GatewayTimeout = "OPENCLAW_GATEWAY_TIMEOUT",
    /** The turn was aborted by its caller. */
    GatewayAborted = "OPENCLAW_GATEWAY_ABORTED",
    /** The gateway closed the socket before it answered. */
    GatewayClosed = "OPENCLAW_GATEWAY_CLOSED",
    /** The socket failed. */
    GatewaySocketFailed = "OPENCLAW_GATEWAY_SOCKET_FAILED",
    /** The run ended in error on the gateway. */
    RunFailed = "OPENCLAW_RUN_FAILED",
    /** Agent registration is switched off or has no config directory. */
    RegistrationOff = "OPENCLAW_REGISTRATION_OFF",
    /** A path of an agent bundle would leave the agent workspace. */
    WorkspacePathUnsafe = "OPENCLAW_WORKSPACE_PATH_UNSAFE",
    /** The process cannot write the agent workspace: the config directory is not set. */
    WorkspaceUnavailable = "OPENCLAW_WORKSPACE_UNAVAILABLE",
}

/** How each OpenClaw code travels. */
export const OPENCLAW_ERROR_KINDS: Record<OpenclawErrorCode, ErrorKind> = {
    [OpenclawErrorCode.ConfigInvalid]: "internal",
    [OpenclawErrorCode.GatewayNotConfigured]: "unavailable",
    [OpenclawErrorCode.GatewayRefused]: "unavailable",
    [OpenclawErrorCode.GatewayDeferred]: "unavailable",
    [OpenclawErrorCode.GatewayTimeout]: "unavailable",
    [OpenclawErrorCode.GatewayAborted]: "unavailable",
    [OpenclawErrorCode.GatewayClosed]: "unavailable",
    [OpenclawErrorCode.GatewaySocketFailed]: "unavailable",
    [OpenclawErrorCode.RunFailed]: "unavailable",
    [OpenclawErrorCode.RegistrationOff]: "unavailable",
    [OpenclawErrorCode.WorkspacePathUnsafe]: "invalid",
    [OpenclawErrorCode.WorkspaceUnavailable]: "unavailable",
}

/** The one error class of the OpenClaw integration. */
export class OpenclawError extends DomainError<OpenclawErrorCode> {}

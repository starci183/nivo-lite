import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-inbound capability. */
export enum AgentInboundErrorCode {
    /** An event names an adapter nobody registered. */
    AdapterUnknown = "AGENT_INBOUND_ADAPTER_UNKNOWN",
    /** Two adapters claim the same key. */
    AdapterDuplicate = "AGENT_INBOUND_ADAPTER_DUPLICATE",
    /** The payload of an event is larger than the door keeps. */
    PayloadTooLarge = "AGENT_INBOUND_PAYLOAD_TOO_LARGE",
    /** An event has no idempotency key. */
    KeyMissing = "AGENT_INBOUND_KEY_MISSING",
    /** An event stopped at a limit and nobody can tell a person: it must not be dropped. */
    StopNotReportable = "AGENT_INBOUND_STOP_NOT_REPORTABLE",
    /** The body of a webhook delivery is not a JSON object. */
    BodyInvalid = "AGENT_INBOUND_BODY_INVALID",
    /** A webhook delivery names no event type, or one that is not a type. */
    EventTypeInvalid = "AGENT_INBOUND_EVENT_TYPE_INVALID",
    /** The endpoint a webhook delivery names is not a connection that can receive it. */
    EndpointUnknown = "AGENT_INBOUND_ENDPOINT_UNKNOWN",
    /** A delivery job names no event: nothing a retry could change. */
    JobPayloadInvalid = "AGENT_INBOUND_JOB_PAYLOAD_INVALID",
}

/** How each agent-inbound code travels. */
export const AGENT_INBOUND_ERROR_KINDS: Record<AgentInboundErrorCode, ErrorKind> = {
    [AgentInboundErrorCode.AdapterUnknown]: "internal",
    [AgentInboundErrorCode.AdapterDuplicate]: "internal",
    [AgentInboundErrorCode.PayloadTooLarge]: "invalid",
    [AgentInboundErrorCode.KeyMissing]: "invalid",
    [AgentInboundErrorCode.StopNotReportable]: "internal",
    [AgentInboundErrorCode.BodyInvalid]: "invalid",
    [AgentInboundErrorCode.EventTypeInvalid]: "invalid",
    [AgentInboundErrorCode.EndpointUnknown]: "not-found",
    [AgentInboundErrorCode.JobPayloadInvalid]: "internal",
}

/** The one error class of the agent-inbound capability. */
export class AgentInboundError extends DomainError<AgentInboundErrorCode> {}

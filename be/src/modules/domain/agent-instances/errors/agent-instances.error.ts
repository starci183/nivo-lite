import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-instances capability. */
export enum AgentInstancesErrorCode {
    /** The display name is empty or longer than its limit after trimming. */
    NameInvalid = "AGENT_INSTANCES_NAME_INVALID",
    /** The @handle is not lowercase letters, digits and hyphens within its limits. */
    HandleInvalid = "AGENT_INSTANCES_HANDLE_INVALID",
    /** The preset picture is not one an agent may wear. */
    AvatarPresetInvalid = "AGENT_INSTANCES_AVATAR_PRESET_INVALID",
    /** The installation to copy the setup of is not an active agent of the same role in this workspace. */
    CopySourceInvalid = "AGENT_INSTANCES_COPY_SOURCE_INVALID",
    /** A chosen channel is not a channel this role can answer, or it is disconnected. */
    ChannelUnavailable = "AGENT_INSTANCES_CHANNEL_UNAVAILABLE",
    /** A chosen channel is already answered by another agent of the same role. */
    ChannelOwned = "AGENT_INSTANCES_CHANNEL_OWNED",
    /** Only the owner gives an agent channels; a manager creates the agent without them. */
    ChannelsNeedOwner = "AGENT_INSTANCES_CHANNELS_NEED_OWNER",
    /** The agent that answers a customer channel could not be installed when the channel was connected; the channel has no owner. */
    FrontDoorFailed = "AGENT_INSTANCES_FRONT_DOOR_FAILED",
}

/** How each agent-instances code travels. */
export const AGENT_INSTANCES_ERROR_KINDS: Record<AgentInstancesErrorCode, ErrorKind> = {
    [AgentInstancesErrorCode.NameInvalid]: "invalid",
    [AgentInstancesErrorCode.HandleInvalid]: "invalid",
    [AgentInstancesErrorCode.AvatarPresetInvalid]: "invalid",
    [AgentInstancesErrorCode.CopySourceInvalid]: "invalid",
    [AgentInstancesErrorCode.ChannelUnavailable]: "invalid",
    [AgentInstancesErrorCode.ChannelOwned]: "conflict",
    [AgentInstancesErrorCode.ChannelsNeedOwner]: "forbidden",
    [AgentInstancesErrorCode.FrontDoorFailed]: "internal",
}

/** The one error class of the agent-instances capability. */
export class AgentInstancesError extends DomainError<AgentInstancesErrorCode> {}

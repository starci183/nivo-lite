import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable refusals of the team chat. A door answers them as data; the codes are the doors' `refusal` values. */
export enum TeamChatErrorCode {
    /** The room, the message or the person is not in this workspace. */
    NotFound = "TEAM_CHAT_NOT_FOUND",
    /** The caller is not a member of the room and not an owner of the workspace. */
    NotMember = "TEAM_CHAT_NOT_MEMBER",
    /** The caller may not do this in this room. */
    Forbidden = "TEAM_CHAT_FORBIDDEN",
    /** A direct room has exactly one other member. */
    DirectNeedsTwo = "TEAM_CHAT_DIRECT_NEEDS_TWO",
    /** A group needs a name of one to eighty characters. */
    GroupNeedsName = "TEAM_CHAT_GROUP_NEEDS_NAME",
    /** A named member is not a person or an agent of this workspace. */
    MemberUnknown = "TEAM_CHAT_MEMBER_UNKNOWN",
    /** The member already sits in the room. */
    AlreadyMember = "TEAM_CHAT_ALREADY_MEMBER",
    /** The member to remove does not sit in the room. */
    NotAMemberToRemove = "TEAM_CHAT_NOT_A_MEMBER_TO_REMOVE",
    /** The last owner of a group cannot leave it. */
    LastOwner = "TEAM_CHAT_LAST_OWNER",
    /** A message has a body or files. */
    BodyEmpty = "TEAM_CHAT_BODY_EMPTY",
    /** The body is longer than 8000 characters. */
    BodyTooLong = "TEAM_CHAT_BODY_TOO_LONG",
    /** A message mentions at most 20 members. */
    TooManyMentions = "TEAM_CHAT_TOO_MANY_MENTIONS",
    /** A message carries at most 10 files. */
    TooManyFiles = "TEAM_CHAT_TOO_MANY_FILES",
    /** A file is larger than 25 MB. */
    FileTooLarge = "TEAM_CHAT_FILE_TOO_LARGE",
    /** The file is not an image, a PDF, a text file or an Office file, so the upload or the send is refused. */
    FileTypeNotAllowed = "TEAM_CHAT_FILE_TYPE_NOT_ALLOWED",
    /** The file store could not be reached or is not part of this app. */
    StorageUnavailable = "TEAM_CHAT_STORAGE_UNAVAILABLE",
    /** The message an agent graph asked to post is not of the shape the effect declares. */
    InvalidAgentMessage = "TEAM_CHAT_INVALID_AGENT_MESSAGE",
    /** The agent or the owner it should speak to is not of the workspace, so the message went nowhere. */
    AgentMessageNotPosted = "TEAM_CHAT_AGENT_MESSAGE_NOT_POSTED",
    /** A room purpose names no module, a module of more than 64 characters, or is given to a direct room. */
    PurposeInvalid = "TEAM_CHAT_PURPOSE_INVALID",
    /** Another room of the workspace already is the common room, or the room of that module. */
    PurposeTaken = "TEAM_CHAT_PURPOSE_TAKEN",
    /** The right to post is held on an agent's seat, so the agent must sit in the room first. */
    PostRightNeedsSeat = "TEAM_CHAT_POST_RIGHT_NEEDS_SEAT",
    /** The emoji is not one of the six the chat reacts with. */
    ReactionInvalid = "TEAM_CHAT_REACTION_INVALID",
    /** The reactions came too fast, or the member already tapped this emoji as often as the chat counts. */
    ReactionRateLimited = "TEAM_CHAT_REACTION_RATE_LIMITED",
}

/** How the refusals travel over the API when a transport turns one into an error. */
export const TEAM_CHAT_ERROR_KINDS: Record<TeamChatErrorCode, ErrorKind> = {
    [TeamChatErrorCode.NotFound]: "not-found",
    [TeamChatErrorCode.NotMember]: "forbidden",
    [TeamChatErrorCode.Forbidden]: "forbidden",
    [TeamChatErrorCode.DirectNeedsTwo]: "invalid",
    [TeamChatErrorCode.GroupNeedsName]: "invalid",
    [TeamChatErrorCode.MemberUnknown]: "not-found",
    [TeamChatErrorCode.AlreadyMember]: "conflict",
    [TeamChatErrorCode.NotAMemberToRemove]: "not-found",
    [TeamChatErrorCode.LastOwner]: "conflict",
    [TeamChatErrorCode.BodyEmpty]: "invalid",
    [TeamChatErrorCode.BodyTooLong]: "invalid",
    [TeamChatErrorCode.TooManyMentions]: "invalid",
    [TeamChatErrorCode.TooManyFiles]: "invalid",
    [TeamChatErrorCode.FileTooLarge]: "invalid",
    [TeamChatErrorCode.FileTypeNotAllowed]: "invalid",
    [TeamChatErrorCode.StorageUnavailable]: "unavailable",
    [TeamChatErrorCode.InvalidAgentMessage]: "invalid",
    [TeamChatErrorCode.AgentMessageNotPosted]: "not-found",
    [TeamChatErrorCode.PurposeInvalid]: "invalid",
    [TeamChatErrorCode.PurposeTaken]: "conflict",
    [TeamChatErrorCode.PostRightNeedsSeat]: "conflict",
    [TeamChatErrorCode.ReactionInvalid]: "invalid",
    [TeamChatErrorCode.ReactionRateLimited]: "rate-limited",
}

/** The typed error of the team chat capability. */
export class TeamChatError extends DomainError<TeamChatErrorCode> {}

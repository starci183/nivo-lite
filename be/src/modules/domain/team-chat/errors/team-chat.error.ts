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
    /** The file type is not allowed. */
    FileTypeNotAllowed = "TEAM_CHAT_FILE_TYPE_NOT_ALLOWED",
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
}

/** The typed error of the team chat capability. */
export class TeamChatError extends DomainError<TeamChatErrorCode> {}

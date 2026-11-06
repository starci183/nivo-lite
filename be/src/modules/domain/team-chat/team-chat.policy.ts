import { BODY_MAX, FILES_MAX, MENTIONS_MAX, PAGE_DEFAULT, PAGE_MAX } from "./team-chat.contracts"
import type { MemberRef } from "./team-chat.contracts"
import { TeamChatErrorCode } from "./errors/team-chat.error"

/** The longest name of a group. */
export const GROUP_NAME_MAX = 80

const sameMember = (left: MemberRef, right: MemberRef): boolean =>
    left.memberKind === right.memberKind && left.memberId === right.memberId

/** The members once each, in the order first named, without `except`. */
export const uniqueMembers = (members: ReadonlyArray<MemberRef>, except: MemberRef | null): Array<MemberRef> =>
    members.reduce<Array<MemberRef>>(
        (kept, member) =>
            (except !== null && sameMember(member, except)) || kept.some((held) => sameMember(held, member))
                ? kept
                : [...kept, member],
        [],
    )

/** The key of a direct room: the two members as `kind:id`, sorted, so the same pair is the same key whoever asks. */
export const directKeyOf = (first: MemberRef, second: MemberRef): string =>
    [first, second]
        .map((member) => `${member.memberKind}:${member.memberId}`)
        .toSorted((left, right) => left.localeCompare(right))
        .join("|")

/** The name of a group once trimmed, or null when it is empty or too long. */
export const groupNameOf = (name: string | null): string | null => {
    const trimmed = name?.trim() ?? ""
    return trimmed.length >= 1 && trimmed.length <= GROUP_NAME_MAX ? trimmed : null
}

/** What is wrong with a message about to be sent, or null: the body, the mentions and the files. */
export const sendProblem = (body: string, mentions: number, files: number): TeamChatErrorCode | null => {
    if (body.length > BODY_MAX) return TeamChatErrorCode.BodyTooLong
    if (mentions > MENTIONS_MAX) return TeamChatErrorCode.TooManyMentions
    if (files > FILES_MAX) return TeamChatErrorCode.TooManyFiles
    return body.trim().length === 0 && files === 0 ? TeamChatErrorCode.BodyEmpty : null
}

/** The page size asked, kept between one and the maximum; the default when none was asked. */
export const pageSizeOf = (first: number | null | undefined): number =>
    Math.min(PAGE_MAX, Math.max(1, Math.trunc(first ?? PAGE_DEFAULT)))

/** The position a thread page starts after: the instant and id of the last message of the page before. */
export interface ThreadPosition {
    /** The instant, ISO text with microseconds as the database printed it. */
    readonly at: string
    /** The message id. */
    readonly id: string
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u
const MICROS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u

/** The opaque cursor of a position. */
export const cursorOf = (position: ThreadPosition): string =>
    Buffer.from(`${position.at}|${position.id}`, "utf8").toString("base64url")

/** The position a cursor names, or null when it is not one this module wrote. */
export const positionOf = (cursor: string): ThreadPosition | null => {
    const [at, id, rest] = Buffer.from(cursor, "base64url").toString("utf8").split("|")
    return at !== undefined && id !== undefined && rest === undefined && MICROS.test(at) && UUID.test(id)
        ? { at, id }
        : null
}

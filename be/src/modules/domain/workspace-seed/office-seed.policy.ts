import { Secret } from "@modules/platform/config"
import { hasEmailAddressShape, isRecord } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import type { OfficeAccountInput, OfficeAuthoritySeed, OfficeInput, OfficeProfile } from "./office-seed.contracts"

const isPlainRecord = (value: unknown): value is Record<string, unknown> => isRecord(value) && !Array.isArray(value)

const invalid = (): never => {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

const text = (value: unknown, max: number): string =>
    typeof value === "string" && value.length > 0 && value.length <= max ? value : invalid()

const ACCOUNT_KEYS: ReadonlySet<string> = new Set(["email", "name", "password"])
const INPUT_KEYS: ReadonlySet<string> = new Set(["schema", "people"])
const PEOPLE_KEYS: ReadonlySet<string> = new Set(["ha", "van"])

const accountOf = (value: unknown): OfficeAccountInput => {
    if (!isPlainRecord(value) || Object.keys(value).some((key) => !ACCOUNT_KEYS.has(key))) return invalid()
    const email = text(value.email, 254).toLowerCase()
    if (!hasEmailAddressShape(email)) return invalid()
    const name = text(value.name, 120).trim()
    if (name.length === 0) return invalid()
    return value.password === undefined ? { email, name } : { email, name, password: text(value.password, 65_536) }
}

/**
 * Parses the private office input (`nivo/workspace-office-input@1`): the accounts of chi Ha and Van, the two people the ensure
 * input does not carry. Its content is never part of a public diagnostic.
 */
export const readOfficeInput = (input: Secret | undefined): OfficeInput => {
    if (input === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputRequired })
    try {
        const value: unknown = JSON.parse(input.reveal())
        if (!isPlainRecord(value) || value.schema !== "nivo/workspace-office-input@1") return invalid()
        if (Object.keys(value).some((key) => !INPUT_KEYS.has(key))) return invalid()
        const people = value.people
        if (!isPlainRecord(people) || Object.keys(people).some((key) => !PEOPLE_KEYS.has(key))) return invalid()
        return { ha: accountOf(people.ha), van: accountOf(people.van) }
    } catch (cause) {
        throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid, cause })
    }
}

/** The department room keys the Hub accepts. */
const ROOMS: ReadonlySet<string> = new Set(["executive", "frontdesk", "sales", "marketing", "care", "accounting"])

const personIssues = (profile: OfficeProfile): ReadonlyArray<string> => [
    ...(Object.values(profile.people).filter((person) => person.role === "owner").length === 1
        ? []
        : ["the office needs one owner"]),
    ...Object.entries(profile.people).flatMap(([key, person]) =>
        ROOMS.has(person.room) ? [] : [`${key} sits in an unknown room`],
    ),
]

const tagsItself = (key: string, canTag: ReadonlyArray<string>): boolean => canTag.includes(key)

const agentIssues = (profile: OfficeProfile): ReadonlyArray<string> =>
    Object.entries(profile.agents).flatMap(([key, agent]) => [
        ...(ROOMS.has(agent.room) ? [] : [`${key} lives in an unknown room`]),
        ...(agent.assignableRooms.every((room) => ROOMS.has(room)) ? [] : [`${key} is open to an unknown room`]),
        ...(tagsItself(key, agent.canTag) ? [`${key} tags itself`] : []),
    ])

const ruleIssues = (authority: OfficeAuthoritySeed): ReadonlyArray<string> =>
    authority.rules.flatMap((rule) => [
        ...(rule.approver_group.rooms.every((room) => ROOMS.has(room)) ? [] : [`${rule.action} asks an unknown room`]),
        ...(rule.auto_max === null || rule.auto_max <= rule.ask_max ? [] : [`${rule.action} has bands out of order`]),
    ])

const grantIssues = (authority: OfficeAuthoritySeed): ReadonlyArray<string> => {
    const actions = new Set(authority.rules.map((rule) => rule.action))
    return authority.grants.flatMap((grant) =>
        actions.has(grant.action) ? [] : [`a grant names the action ${grant.action} that no rule has`],
    )
}

/**
 * What is wrong with an office profile and its authority data, as readable lines; none means what the types cannot say holds: one
 * owner, every room real, no agent tagging itself, bands in order, and every grant naming the action of a rule.
 */
export const officeIssuesOf = (profile: OfficeProfile, authority: OfficeAuthoritySeed): ReadonlyArray<string> => [
    ...personIssues(profile),
    ...agentIssues(profile),
    ...ruleIssues(authority),
    ...grantIssues(authority),
]

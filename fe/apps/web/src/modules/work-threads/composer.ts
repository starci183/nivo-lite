import type { MentionDirectoryType } from "@/modules/api"
import type { ComposerOption } from "@/modules/types"

/** The words of the three sections the suggestions come from. */
interface SectionWords {
    readonly member: string
    readonly agent: string
    readonly group: string
}

/** A tag the author picked from the suggestions. */
export interface PickedMention {
    readonly kind: "member" | "agent" | "group"
    readonly id: string
    readonly label: string
}

const KINDS: ReadonlyArray<PickedMention["kind"]> = ["member", "agent", "group"]

/** The id of a suggestion: kind and id, so two kinds never collide. */
const optionId = (kind: string, id: string): string => `${kind}:${id}`

/** The suggestions of the `@` list: people first, then agents, then groups, each with its section and role as the second line. */
export const composerOptionsOf = (
    directory: MentionDirectoryType | undefined,
    words: SectionWords,
): ReadonlyArray<ComposerOption> => {
    if (directory === undefined) return []
    const line = (section: string, role: string): string => (role === "" ? section : `${section} · ${role}`)
    return [
        ...directory.members.map((option) => ({
            id: optionId(option.kind, option.id),
            label: option.name,
            description: line(words.member, option.role),
        })),
        ...directory.agents.map((option) => ({
            id: optionId(option.kind, option.id),
            label: option.name,
            description: line(words.agent, option.role),
        })),
        ...directory.groups.map((option) => ({
            id: optionId(option.kind, option.id),
            label: option.name,
            description: line(words.group, ""),
        })),
    ]
}

/** The tag a chosen suggestion stands for, or none for an id this list never made. */
export const pickedOf = (option: ComposerOption): PickedMention | null => {
    const [kind, ...rest] = option.id.split(":")
    const known = KINDS.find((candidate) => candidate === kind)
    return known === undefined ? null : { kind: known, id: rest.join(":"), label: option.label }
}

/** The tags to send: the picked ones the draft still names with an at sign, each once. The text itself never makes a tag. */
export const mentionsToSend = (
    draft: string,
    picked: ReadonlyArray<PickedMention>,
): ReadonlyArray<{ readonly kind: PickedMention["kind"]; readonly id: string }> =>
    picked
        .filter((tag, index) => picked.findIndex((other) => other.kind === tag.kind && other.id === tag.id) === index)
        .filter((tag) => draft.includes(`@${tag.label}`))
        .map((tag) => ({ kind: tag.kind, id: tag.id }))

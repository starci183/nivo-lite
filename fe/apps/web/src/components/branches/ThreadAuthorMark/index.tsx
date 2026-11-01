import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ModuleIconName } from "@/modules/types"

/** Who wrote a message. */
type ThreadAuthorMarkProps = {
    readonly name: string
    /** The module glyph of an agent author; null for a person. */
    readonly glyph: ModuleIconName | null
}

/** The mark beside a message: the module glyph for an agent, the initials for a person, so the two are never confused. */
export const ThreadAuthorMark = (props: ThreadAuthorMarkProps) => {
    if (props.glyph === null) return <PersonAvatar name={props.name} size="sm" />
    return <AgentMark glyph={nivoIconSource(props.glyph, "leading")} label={props.name} seed={props.name} size="sm" />
}

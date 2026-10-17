import { nivoIconSource } from "@/components/leaves/Icon"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { OfficeAvatarView } from "@/modules/types"

/** The size of the mark. */
type OfficeAvatarSize = "xs" | "sm" | "md"

/** Who is drawn. */
type OfficeAvatarProps = {
    readonly avatar: OfficeAvatarView
    readonly size?: OfficeAvatarSize
}

/** An installed agent or a person (NIVO Core is a person mark named NIVO), each with its own mark so they are never confused. */
export const OfficeAvatar = (props: OfficeAvatarProps) => {
    const { avatar } = props
    if (avatar.kind === "agent") {
        return (
            <AgentMark
                glyph={nivoIconSource(avatar.glyph, "leading")}
                label={avatar.label}
                module={avatar.module}
                size={props.size}
            />
        )
    }
    return <PersonAvatar name={avatar.name} size={props.size} />
}

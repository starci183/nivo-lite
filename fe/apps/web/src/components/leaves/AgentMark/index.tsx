"use client"

import { Avatar } from "@starci/grammar/common"
import type { AvatarSize } from "@starci/grammar/common"

/** What the agent mark draws. */
type AgentMarkProps = {
    /** Accept legacy caller metadata (the module glyph) while the mark renders only its visual props. */
    readonly [metadata: string]: unknown
    /** The agent's display name: the spoken name of the mark and its initials while the picture loads. */
    readonly label: string
    /** The agent id when the caller knows it: the generated avatar of an agent without a picture. Defaults to the name. */
    readonly seed?: string | undefined
    /** The picture the owner gave the agent. */
    readonly src?: string | null | undefined
    /** The agent is not known yet: the avatar draws as a waiting shape. */
    readonly isSkeleton?: boolean | undefined
    readonly size?: "xs" | "sm" | "md" | "lg" | "control" | undefined
}

/** The grammar publishes no 24px avatar: `xs` takes its smallest plate. */
const AVATAR_SIZE: Record<NonNullable<AgentMarkProps["size"]>, AvatarSize> = {
    xs: "sm",
    sm: "sm",
    md: "md",
    lg: "lg",
    control: "control",
}

/** An AI agent as a person-like Grammar avatar: its picture, else the generated avatar of its seed. The bot badge is Grammar's. */
export const AgentMark = (props: AgentMarkProps) => (
    <Avatar
        name={props.label}
        kind="agent"
        seed={props.seed ?? props.label}
        {...(props.src ? { src: props.src } : {})}
        size={AVATAR_SIZE[props.size ?? "md"]}
        isSkeleton={props.isSkeleton === true}
    />
)

"use client"

import { Avatar } from "@starci/grammar/common"
import type { AvatarSize } from "@starci/grammar/common"

/** What the agent mark draws. */
type AgentMarkProps = {
    /** The agent's display name: the spoken name of the mark . */
    readonly label: string
    /** The agent id: the one seed of the colour drawn while the picture loads, so the same agent wears the same colour on every screen. */
    readonly seed: string
    /** The picture the owner gave the agent; without one Grammar draws its fallback mark of the name. */
    readonly src?: string | null | undefined
    /** The agent is not known yet: the avatar draws as a waiting shape. */
    readonly isLoading?: boolean | undefined
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

/** An AI agent as a person-like Grammar avatar: its picture, else the mark Grammar draws for its name (a sprout). The bot badge is Grammar's. */
export const AgentMark = (props: AgentMarkProps) => (
    <Avatar
        name={props.label}
        kind="agent"
        seed={props.seed}
        {...(props.src ? { src: props.src } : {})}
        size={AVATAR_SIZE[props.size ?? "md"]}
        isLoading={props.isLoading === true}
    />
)

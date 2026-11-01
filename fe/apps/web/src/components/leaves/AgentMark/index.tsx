"use client"

import { Avatar } from "@starci/grammar/common"
import type { AvatarSize } from "@starci/grammar/common"

/** The NIVO unicorn mascot: the picture of every agent the owner has not given its own. */
const AGENT_MASCOT_SRC = "/images/agents/mascot-avatar.webp"

/** What the agent mark draws. */
type AgentMarkProps = {
    /** Accept legacy caller metadata (the module glyph) while the mark renders only its visual props. */
    readonly [metadata: string]: unknown
    /** The agent's display name: the spoken name of the mark and its initials while the picture loads. */
    readonly label: string
    /** The agent id: the one seed of the colour drawn while the picture loads, so the same agent wears the same colour on every screen. */
    readonly seed: string
    /** The picture the owner gave the agent; without one the NIVO unicorn mascot is drawn. */
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

/** An AI agent as a person-like Grammar avatar: its picture, else the NIVO unicorn mascot, never initials on a colour. The bot badge is Grammar's. */
export const AgentMark = (props: AgentMarkProps) => (
    <Avatar
        name={props.label}
        kind="agent"
        seed={props.seed}
        src={props.src ? props.src : AGENT_MASCOT_SRC}
        size={AVATAR_SIZE[props.size ?? "md"]}
        isSkeleton={props.isSkeleton === true}
    />
)

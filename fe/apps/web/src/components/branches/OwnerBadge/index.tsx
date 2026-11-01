import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { OWNER_MARK_CLASS, OWNER_TEXT_CLASS } from "./classNames"

/** What the owner mark draws. */
type OwnerBadgeProps = {
    readonly kind: "human" | "agent"
    readonly name: string
    /** The module key of the agent. */
    readonly handle: string | null
    /** Semantic Icon name of the agent glyph. */
    readonly glyph: ModuleIconName
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null
    /** The words under the name: the role of the owner. */
    readonly role: string
    /** The owner is drawn from the placeholder while the read is in flight. */
    readonly isSkeleton?: boolean
}

/** The owner identity in a section header: an avatar for people, a module tile for agents, with name and role. */
export const OwnerBadge = (props: OwnerBadgeProps) => (
    <div className={OWNER_MARK_CLASS}>
        {props.kind === "agent" ? (
            <AgentMark
                glyph={nivoIconSource(props.glyph, "leading")}
                label={props.name}
                src={props.avatarUrl}
                module={props.handle ?? "chatbot"}
                size="md"
            />
        ) : (
            <PersonAvatar name={props.name} size="md" />
        )}
        <div className={OWNER_TEXT_CLASS}>
            <Text weight="semibold" overflow="truncate" isSkeleton={props.isSkeleton ?? false}>
                {props.name}
            </Text>
            <Text size="sm" tone="muted" overflow="truncate" isSkeleton={props.isSkeleton ?? false}>
                {props.role}
            </Text>
        </div>
    </div>
)

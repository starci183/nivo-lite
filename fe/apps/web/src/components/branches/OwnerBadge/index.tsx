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
    /** SVG path data of the agent glyph. */
    readonly glyph: string
    /** The words under the name: the role of the owner. */
    readonly role: string
}

/** The owner identity in a section header: an avatar for people, a module tile for agents, with name and role. */
export const OwnerBadge = (props: OwnerBadgeProps) => (
    <div className={OWNER_MARK_CLASS}>
        {props.kind === "agent" ? (
            <AgentMark glyph={props.glyph} label={props.name} module={props.handle ?? "chatbot"} size="md" />
        ) : (
            <PersonAvatar name={props.name} size="md" />
        )}
        <div className={OWNER_TEXT_CLASS}>
            <Text weight="semibold" overflow="truncate">
                {props.name}
            </Text>
            <Text size="sm" tone="muted" overflow="truncate">
                {props.role}
            </Text>
        </div>
    </div>
)

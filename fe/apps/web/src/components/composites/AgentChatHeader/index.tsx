import { Avatar, Badge, Button, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { BACK_CLASS_NAME, HEADER_ACTIONS_CLASS_NAME, HEADER_CLASS_NAME, HEADER_COPY_CLASS_NAME } from "./classNames"

/** The words and state of the chat header, with what its controls do. */
export interface AgentChatHeaderProps {
    readonly backLabel: string
    readonly name: string
    readonly subtitle: string
    readonly glyph: string
    readonly module: string
    /** The agent is still loading: the mark and the lines draw as waiting shapes. */
    readonly isSkeleton: boolean
    /** The mark that says the conversation is real, or null. */
    readonly badge: string | null
    /** The takeover control, or null when the conversation cannot be taken over. */
    readonly takeover: { readonly label: string; readonly isPending: boolean } | null
    /** The label of the open-the-lead control, or null when there is no lead. */
    readonly openLeadLabel: string | null
    readonly historyLabel: string
    readonly setup: { readonly label: string; readonly href: string } | null
    readonly onBack: () => void
    readonly onTakeover: () => void
    readonly onOpenLead: () => void
    readonly onToggleList: () => void
}

/** What the mark of the header needs. */
interface HeaderMarkProps {
    readonly glyph: string
    readonly module: string
    readonly name: string
    readonly isSkeleton: boolean
}

/** The mark of the agent, or a waiting avatar while the agent loads. */
const HeaderMark = (props: HeaderMarkProps) => {
    if (props.isSkeleton) return <Avatar name="" size="md" isSkeleton />
    return <AgentMark glyph={props.glyph} module={props.module} label={props.name} size="md" />
}

/** The header of the chat: who the agent is, what state the conversation is in and what the owner can do with it. */
export const AgentChatHeader = (props: AgentChatHeaderProps) => (
    <div className={HEADER_CLASS_NAME}>
        <div className={BACK_CLASS_NAME}>
            <Button variant="ghost" size="sm" onPress={props.onBack}>
                {props.backLabel}
            </Button>
        </div>
        <HeaderMark glyph={props.glyph} module={props.module} name={props.name} isSkeleton={props.isSkeleton} />
        <div className={HEADER_COPY_CLASS_NAME}>
            <Text weight="semibold" overflow="truncate" isSkeleton={props.isSkeleton}>
                {props.name}
            </Text>
            <Text size="xs" tone="muted" overflow="truncate" isSkeleton={props.isSkeleton}>
                {props.subtitle}
            </Text>
        </div>
        <div className={HEADER_ACTIONS_CLASS_NAME}>
            {props.badge === null ? null : <Badge tone="success">{props.badge}</Badge>}
            {props.takeover === null ? null : (
                <Button variant="outline" size="sm" isPending={props.takeover.isPending} onPress={props.onTakeover}>
                    {props.takeover.label}
                </Button>
            )}
            {props.openLeadLabel === null ? null : (
                <Button variant="outline" size="sm" onPress={props.onOpenLead}>
                    {props.openLeadLabel}
                </Button>
            )}
            <Button variant="ghost" size="sm" isDisabled={props.isSkeleton} onPress={props.onToggleList}>
                {props.historyLabel}
            </Button>
            {props.setup === null ? null : (
                <Button variant="ghost" size="sm" href={props.setup.href}>
                    {props.setup.label}
                </Button>
            )}
        </div>
    </div>
)

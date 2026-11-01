import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { Avatar, Badge, Button, Cluster, Stack, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { BACK_CLASS_NAME } from "./classNames"

/** The words and state of the chat header, with what its controls do. */
export interface AgentChatHeaderProps {
    readonly backLabel: string
    readonly name: string
    readonly subtitle: string
    readonly glyph: ModuleIconName
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    /** The id of the agent: the one seed of its mark on every screen. */
    readonly seed: string
    readonly module: string
    /** The agent is still loading: the mark and the lines draw as waiting shapes. */
    readonly isSkeleton: boolean
    /** The mark that says the conversation is real, or null. */
    readonly badge: string | null
    /** The takeover control, or null when the conversation cannot be taken over. */
    readonly takeover: { readonly label: string; readonly isPending: boolean } | null
    /** The label of the open-the-lead control, or null when there is no lead. */
    readonly openLeadLabel: string | null
    readonly setup: { readonly label: string; readonly href: string } | null
    readonly onBack: () => void
    readonly onTakeover: () => void
    readonly onOpenLead: () => void
}

/** What the mark of the header needs. */
interface HeaderMarkProps {
    readonly glyph: ModuleIconName
    readonly module: string
    readonly name: string
    readonly avatarUrl: string | null | undefined
    readonly seed: string
    readonly isSkeleton: boolean
}

/** The mark of the agent, or a waiting avatar while the agent loads. */
const HeaderMark = (props: HeaderMarkProps) => {
    if (props.isSkeleton) return <Avatar name="" size="md" isSkeleton />
    return (
        <AgentMark
            glyph={nivoIconSource(props.glyph, "leading")}
            module={props.module}
            label={props.name}
            seed={props.seed}
            src={props.avatarUrl}
            size="md"
        />
    )
}

/** The header of the chat: who the agent is, what state the conversation is in and what the owner can do with it. */
export const AgentChatHeader = (props: AgentChatHeaderProps) => (
    <Cluster gap="row" justify="between">
        <Cluster gap="row" wrap={false}>
            <div className={BACK_CLASS_NAME}>
                <Button intent="neutral" size="sm" onPress={props.onBack}>
                    {props.backLabel}
                </Button>
            </div>
            <HeaderMark
                glyph={props.glyph}
                module={props.module}
                name={props.name}
                avatarUrl={props.avatarUrl}
                seed={props.seed}
                isSkeleton={props.isSkeleton}
            />
            <Stack gap="identity">
                <Text weight="semibold" overflow="truncate" isSkeleton={props.isSkeleton}>
                    {props.name}
                </Text>
                <Text size="xs" tone="muted" overflow="truncate" isSkeleton={props.isSkeleton}>
                    {props.subtitle}
                </Text>
            </Stack>
        </Cluster>
        <Cluster gap="inline">
            {props.badge === null ? null : <Badge tone="success">{props.badge}</Badge>}
            {props.takeover === null ? null : (
                <Button intent="neutral" size="sm" isPending={props.takeover.isPending} onPress={props.onTakeover}>
                    {props.takeover.label}
                </Button>
            )}
            {props.openLeadLabel === null ? null : (
                <Button intent="neutral" size="sm" onPress={props.onOpenLead}>
                    {props.openLeadLabel}
                </Button>
            )}
            {props.setup === null ? null : (
                <Button intent="neutral" size="sm" href={props.setup.href}>
                    {props.setup.label}
                </Button>
            )}
        </Cluster>
    </Cluster>
)

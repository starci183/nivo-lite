import { Badge, Button, Cluster, DropdownMenu, IconButton, PaneHeader, PaneSection } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import { PHONE_ONLY_CLASS_NAME, WIDE_ONLY_CLASS_NAME } from "./classNames"

/** The words and state of the chat header, with what its controls do. */
export interface AgentChatHeaderProps {
    readonly backLabel: string
    readonly name: string
    readonly subtitle: string
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    /** The id of the agent: the one seed of its mark on every screen. */
    readonly seed: string
    /** The agent is still loading: the mark and the lines draw as waiting shapes. */
    readonly isLoading: boolean
    /** The mark that says the conversation is real, or null. */
    readonly badge: string | null
    /** The takeover control, or null when the conversation cannot be taken over. */
    readonly takeover: { readonly label: string; readonly isPending: boolean } | null
    readonly setup: { readonly label: string; readonly href: string } | null
    /** The names of the button that opens the conversation history (a drawer on a phone) and of the menu. */
    readonly historyLabel: string
    readonly moreLabel: string
    /** The test channel names setup in the head; the customer channel keeps it in the menu. */
    readonly isTest: boolean
    readonly onBack: () => void
    readonly onHistory: () => void
    readonly onTakeover: () => void
}

/** The commands behind the menu: all of them on a phone, setup alone from the medium width. */
const entriesOf = (props: AgentChatHeaderProps, isPhone: boolean): ReadonlyArray<DropdownMenuEntry> => [
    ...(isPhone && props.takeover !== null
        ? [{ id: "takeover", label: props.takeover.label, onAction: props.onTakeover }]
        : []),
    ...(props.setup === null ? [] : [{ id: "setup", label: props.setup.label, href: props.setup.href }]),
]

/** The menu of more commands, drawn as the icon button every pane head uses. */
/** What the menu of more commands draws. */
interface MoreMenuProps {
    readonly label: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

const MoreMenu = (props: MoreMenuProps) =>
    props.entries.length === 0 ? null : (
        <DropdownMenu
            placement="bottom end"
            entries={[...props.entries]}
            trigger={<IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={props.label} />}
        />
    )

/** The commands of a conversation from the medium width: takeover, the lead, and setup (a button on the test channel, else a menu). */
const WideCommands = (props: AgentChatHeaderProps) => (
    <div className={WIDE_ONLY_CLASS_NAME}>
        <Cluster gap="inline" wrap={false}>
            {props.takeover === null ? null : (
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={props.takeover.isPending}
                    startContent={<Icon props={{ name: "handRaised", usage: "leading" }} />}
                    onPress={props.onTakeover}
                >
                    {props.takeover.label}
                </Button>
            )}
            {props.isTest && props.setup !== null ? (
                <Button intent="neutral" size="sm" href={props.setup.href}>
                    {props.setup.label}
                </Button>
            ) : (
                <MoreMenu label={props.moreLabel} entries={entriesOf(props, false)} />
            )}
        </Cluster>
    </div>
)

/** The header of the chat: who the agent is, what state the conversation is in and what the owner can do with it. */
export const AgentChatHeader = (props: AgentChatHeaderProps) => (
    <PaneSection align="center">
        <PaneHeader
            title={props.name}
            headingLevel={1}
            description={props.subtitle}
            mark={<AgentMark label={props.name} seed={props.seed} src={props.avatarUrl} size="md" />}
            {...(props.badge === null ? {} : { status: <Badge tone="success">{props.badge}</Badge> })}
            isLoading={props.isLoading}
            back={{ label: props.backLabel, onPress: props.onBack }}
            actions={
                <>
                    <WideCommands {...props} />
                    <div className={PHONE_ONLY_CLASS_NAME}>
                        <Cluster gap="inline" wrap={false}>
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("history", "leading")}
                                label={props.historyLabel}
                                onPress={props.onHistory}
                            />
                            <MoreMenu label={props.moreLabel} entries={entriesOf(props, true)} />
                        </Cluster>
                    </div>
                </>
            }
        />
    </PaneSection>
)

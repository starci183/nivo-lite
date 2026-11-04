import type { ReactNode } from "react"
import { Badge, Button, DropdownMenu, EmptyNotice, IconButton, PaneSection } from "@starci/grammar/common"
import type { BadgeTone, DropdownMenuEntry, PaneHeaderProps } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ConnectionRefusalView } from "@/modules/types"

/** One chip beside the connection's name: its state, and its environment when it has one. */
interface ConnectionStatusChip {
    readonly label: string
    readonly tone: BadgeTone
    readonly isDot?: boolean
}

/** What the head band of a provider page draws. */
interface ConnectionHeadBandProps {
    readonly title: string
    /** The one line under the name: what identifies the connection on the provider's side. */
    readonly facts: string
    /** The provider's own mark. */
    readonly mark: ReactNode
    readonly statuses: ReadonlyArray<ConnectionStatusChip>
    readonly isLoading: boolean
    /** A phone returns to the list. */
    readonly back: NonNullable<PaneHeaderProps["back"]>
    /** The one command of the band (check again, grant again). */
    readonly action?: {
        readonly label: string
        readonly intent: "commit" | "alternative" | "neutral"
        readonly isPending: boolean
        readonly onPress: () => void
    }
    /** The commands beyond the one visible one, behind the "more" button. */
    readonly menu?: { readonly label: string; readonly entries: ReadonlyArray<DropdownMenuEntry> }
    /** A question the band's commands open (disconnect asks first); drawn in a portal, so it takes no room in the band. */
    readonly question?: ReactNode
}

/** The head band of a provider connection page, the same for every provider: mark, name, chips, facts, the one command and the menu. */
export const ConnectionHeadBand = (props: ConnectionHeadBandProps) => (
    <PaneHead
        title={props.title}
        headingLevel={1}
        description={props.facts}
        mark={props.mark}
        status={
            <>
                {props.statuses.map((chip) => (
                    <Badge key={chip.label} tone={chip.tone} isDot={chip.isDot === true}>
                        {chip.label}
                    </Badge>
                ))}
            </>
        }
        isLoading={props.isLoading}
        back={props.back}
        actions={
            <>
                {props.action === undefined ? null : (
                    <Button
                        intent={props.action.intent}
                        isPending={props.action.isPending}
                        onPress={props.action.onPress}
                    >
                        {props.action.label}
                    </Button>
                )}
                {props.menu === undefined || props.menu.entries.length === 0 ? null : (
                    <DropdownMenu
                        placement="bottom end"
                        entries={[...props.menu.entries]}
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("more", "leading")}
                                label={props.menu.label}
                            />
                        }
                    />
                )}
                {props.question}
            </>
        }
    />
)

/** The head of a member who may not read a provider page: the title alone. */
export const connectionRefusedTitleOf = (refusal: ConnectionRefusalView): string => refusal.title

/** Why the member may not read the page. */
interface ConnectionPaneLayoutNoticeProps {
    readonly refusal: ConnectionRefusalView | undefined
}

/** What the main pane of a provider page opens with for a member who may not read it, and nothing for anyone else. */
export const ConnectionPaneLayoutNotice = (props: ConnectionPaneLayoutNoticeProps): ReactNode =>
    props.refusal === undefined ? null : (
        <PaneSection>
            <EmptyNotice message={props.refusal.message} description={props.refusal.description} />
        </PaneSection>
    )

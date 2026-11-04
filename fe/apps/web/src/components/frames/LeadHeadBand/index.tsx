import { Avatar, Badge, DropdownMenu, IconButton } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { LeadHeadLabels, LeadHeadPane, LeadPanesOn } from "@/modules/types"

/** What the head band of an open lead draws and which commands its menu runs. */
interface LeadHeadBandProps {
    readonly pane: LeadHeadPane
    readonly labels: LeadHeadLabels
    /** The wide aside is shown, so its opener offers to hide it. */
    readonly isInfoOpen: boolean
    readonly hasBrief: boolean
    readonly backLabel: string
    readonly on: Pick<
        LeadPanesOn,
        "back" | "draft" | "refresh" | "copy" | "copyBrief" | "outcomeOpen" | "stepOpen" | "toggleInfo"
    >
}

/** The menu of the lead: the commands the mockup keeps out of the page (Office, refresh, outcome, owner, due date, copy). */
const entriesOf = (props: LeadHeadBandProps): ReadonlyArray<DropdownMenuEntry> => {
    const { labels, on } = props
    return [
        { id: "office", label: labels.office, href: labels.officeHref },
        { id: "refresh", label: labels.menuRefresh, onAction: on.refresh },
        { id: "outcome", label: labels.menuOutcome, onAction: on.outcomeOpen },
        { id: "reassign", label: labels.menuReassign, onAction: () => on.stepOpen("reassign") },
        { id: "due", label: labels.menuDue, onAction: () => on.stepOpen("due") },
        { id: "copy", label: labels.menuCopy, onAction: on.copy },
        ...(props.hasBrief ? [{ id: "copyBrief", label: labels.menuCopyBrief, onAction: on.copyBrief }] : []),
    ]
}

/** The head band of the open lead: its avatar, name, stage and line, the Office link, the menu and the aside opener; the one primary is drafting a reply. */
export const LeadHeadBand = (props: LeadHeadBandProps) => {
    const { pane, labels, on } = props
    const isLoading = "isLoading" in pane.slot
    const view = "items" in pane.slot ? pane.slot.items : null
    const primary =
        pane.primary === "draft" && pane.responsibilityId !== null && !isLoading
            ? {
                  label: labels.draft,
                  isPending: pane.isPending,
                  onPress: () => on.draft(pane.responsibilityId ?? ""),
              }
            : undefined
    return (
        <PaneHead
            title={view?.name ?? labels.fallbackTitle}
            headingLevel={1}
            {...(view === null ? {} : { description: view.meta })}
            mark={<Avatar name={view?.name ?? labels.fallbackTitle} size="sm" isLoading={isLoading} />}
            {...(view === null ? {} : { status: <Badge tone={view.stageTone}>{view.stageLabel}</Badge> })}
            isLoading={isLoading}
            back={{ label: props.backLabel, onPress: on.back }}
            {...(primary === undefined ? {} : { primary })}
            actions={
                <>
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("chat", "leading")}
                        label={labels.office}
                        href={labels.officeHref}
                    />
                    <DropdownMenu
                        placement="bottom end"
                        entries={entriesOf(props)}
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("more", "leading")}
                                label={labels.moreActions}
                            />
                        }
                    />
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("sidebar", "leading")}
                        label={props.isInfoOpen ? labels.infoClose : labels.infoOpen}
                        onPress={on.toggleInfo}
                    />
                </>
            }
        />
    )
}

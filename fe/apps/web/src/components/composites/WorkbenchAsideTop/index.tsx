import { Alert, IconButton, PaneHeader, PaneSection, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type {
    WorkbenchAsideActions,
    WorkbenchAsideView,
    WorkbenchDashboardRegions,
    WorkbenchExplanationView,
} from "@/modules/types"
import { BANNER_CLASS_NAME, HIDDEN_BANNER_CLASS_NAME } from "./classNames"

/** The side pane's state and commands, which the connected owner resolves from the address. */
interface AsideState {
    readonly view: WorkbenchAsideView
    readonly on: WorkbenchAsideActions
}

/** How many decisions wait, once the read has settled; null while it has not, never a zero that is not known. */
const waitingCountOf = (regions: WorkbenchDashboardRegions): string | null => {
    const slot = regions.waiting.slot
    return "items" in slot ? slot.items.count : null
}

/** The first waiting decision's title, which the band of a narrow screen names. */
const firstWaitingOf = (regions: WorkbenchDashboardRegions): string | undefined => {
    const slot = regions.waiting.slot
    return "items" in slot ? slot.items.rows[0]?.title : undefined
}

/** What the band that opens the decisions reads. */
interface WorkbenchAsideBandProps {
    readonly regions: WorkbenchDashboardRegions
    readonly openLabel: string
    /** Absent while the workbench is not wired to the side pane's state: no band. */
    readonly aside: AsideState | undefined
}

/**
 * Below the side pane's width the decisions are one tap away: a soft band names how many wait and the first of them, and opens
 * the side pane as the page. Where the owner closed the side pane the band stays at every width, as the way to open it again.
 */
export const WorkbenchAsideBand = (props: WorkbenchAsideBandProps) => {
    const count = waitingCountOf(props.regions)
    if (props.aside === undefined || count === null) return null
    const first = firstWaitingOf(props.regions)
    return (
        <div className={props.aside.view.isHidden ? BANNER_CLASS_NAME : HIDDEN_BANNER_CLASS_NAME}>
            <Alert
                tone="informative"
                title={`${props.regions.waiting.label} \u00b7 ${count}`}
                {...(first === undefined ? {} : { description: first })}
                action={{ label: props.openLabel, onAction: props.aside.on.open }}
            />
        </div>
    )
}

/** The head of the side pane reads the explanation, the regions and the pane's state. */
interface WorkbenchAsideTopProps {
    readonly view: {
        readonly why: WorkbenchExplanationView
        readonly regions: WorkbenchDashboardRegions
    }
    readonly onCloseWhy: () => void
    readonly aside: AsideState
}

/** The head of the pane's controls: its title, the way back on a phone and the way to close it. */
interface AsideHeadProps {
    readonly title: string
    readonly count: string | null
    readonly backLabel: string
    readonly closeLabel: string
    readonly onClose: () => void
}

const AsideHead = (props: AsideHeadProps) => (
    <PaneSection align="center">
        <PaneHeader
            title={props.title}
            back={{ label: props.backLabel, onPress: props.onClose }}
            {...(props.count === null ? {} : { status: <Text tone="muted">{`(${props.count})`}</Text> })}
            actions={
                <IconButton
                    intent="dismiss"
                    source={nivoIconSource("close", "leading")}
                    label={props.closeLabel}
                    onPress={props.onClose}
                />
            }
        />
    </PaneSection>
)

/** The head of the side pane: what waits (with how many) and the way to close it, or the explanation of one decision and the way back. */
export const WorkbenchAsideTop = (props: WorkbenchAsideTopProps) => {
    const { view, aside } = props
    if (view.why.workItemId !== null) {
        return (
            <AsideHead
                title={view.why.paneLabel}
                count={null}
                backLabel={aside.view.copy.back}
                closeLabel={view.why.closeLabel}
                onClose={props.onCloseWhy}
            />
        )
    }
    return (
        <AsideHead
            title={view.regions.waiting.label}
            count={waitingCountOf(view.regions)}
            backLabel={aside.view.copy.back}
            closeLabel={aside.view.copy.close}
            onClose={aside.on.close}
        />
    )
}

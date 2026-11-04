import { Button, Page, Pane, PaneGrid } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { OverviewAsideLists } from "@/components/composites/OverviewAsideLists"
import { OverviewAsideWaiting } from "@/components/composites/OverviewAsideWaiting"
import { OverviewDepartments } from "@/components/composites/OverviewDepartments"
import { OverviewResultsCard } from "@/components/composites/OverviewResultsCard"
import { OverviewSetupCard } from "@/components/composites/OverviewSetupCard"
import { OverviewWeekCard } from "@/components/composites/OverviewWeekCard"
import { OverviewWorkCard } from "@/components/composites/OverviewWorkCard"
import { PaneHead } from "@/components/composites/PaneHead"
import type { PanePrimary } from "@/components/composites/PaneHead"
import { PaneBody } from "@/components/frames/PaneBody"
import { Icon } from "@/components/leaves/Icon"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { DataSlot, PaneGridLayout, SlotLabels, OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** Props for {@link OverviewPaneBase}. */
export interface OverviewPaneBaseProps {
    readonly props: {
        readonly copy: OverviewPaneCopy
        readonly title: string
        readonly slot: DataSlot<OverviewPaneReady>
        readonly placeholder: OverviewPaneReady
        readonly labels: SlotLabels
        readonly isAsideOpen: boolean
        readonly isSetupOpen: boolean
        readonly isResultsOpen: boolean
        readonly grid: PaneGridLayout
    }
    readonly on: {
        readonly retry: () => void
        readonly go: (href: string) => void
        readonly asideOpenChange: (isOpen: boolean) => void
        readonly toggleSetup: () => void
        readonly toggleResults: () => void
    }
}

type Props = OverviewPaneBaseProps

/** The two commands of the head: the filled one is the Office when something waits, else a new customer. */
interface HeadCommands {
    readonly primary: PanePrimary | undefined
    readonly other: PanePrimary
}

/** Which command is the filled one: the Office while decisions wait, a new customer while work is open, none for an empty page. */
const commandsOf = (view: Props, ready: OverviewPaneReady | null): HeadCommands => {
    const { copy } = view.props
    const office = { label: copy.openOffice, onPress: () => view.on.go(CONSOLE_ROUTES.chat) }
    const lead = { label: copy.newLead, onPress: () => view.on.go(CONSOLE_ROUTES.newLead) }
    if (ready === null || ready.pending > 0) return { primary: office, other: lead }
    if (ready.work.rows.length > 0) return { primary: lead, other: office }
    return { primary: undefined, other: office }
}

/** What the main pane's regions draw. */
interface MainSectionsProps {
    readonly data: OverviewPaneReady
    readonly view: Props
    readonly isLoading: boolean
}

/** The regions of the main pane, drawn once from the ready data or from the same shape while it loads. */
const MainSections = (props: MainSectionsProps) => {
    const { copy, isSetupOpen, isResultsOpen } = props.view.props
    const { data, isLoading } = props
    return (
        <>
            <OverviewSetupCard
                data={data.setup}
                copy={copy}
                isOpen={isSetupOpen}
                onToggle={props.view.on.toggleSetup}
                isLoading={isLoading}
            />
            <OverviewWeekCard data={data.week} copy={copy} isLoading={isLoading} />
            <OverviewWorkCard data={data.work} copy={copy} onGo={props.view.on.go} isLoading={isLoading} />
            <OverviewDepartments data={data.departments} copy={copy} isLoading={isLoading} />
            <OverviewResultsCard
                data={data.results}
                copy={copy}
                isOpen={isResultsOpen}
                onToggle={props.view.on.toggleResults}
                isLoading={isLoading}
            />
        </>
    )
}

/** What the head band draws. */
interface HeadProps {
    readonly view: Props
    readonly ready: OverviewPaneReady | null
}

/** The head band: the greeting, its line (kept real while the read waits), and the commands. */
const Head = (props: HeadProps) => {
    const view = props.view.props
    const commands = commandsOf(props.view, props.ready)
    const shown = props.ready ?? view.placeholder
    return (
        <PaneHead
            title={view.title}
            headingLevel={1}
            {...("isError" in view.slot ? {} : { description: shown.head.description })}
            actions={
                <Button
                    intent="alternative"
                    size="sm"
                    {...(commands.other.label === view.copy.newLead
                        ? { startContent: <Icon props={{ name: "add", usage: "leading" }} /> }
                        : {})}
                    onPress={commands.other.onPress}
                >
                    {commands.other.label}
                </Button>
            }
            {...(commands.primary === undefined ? {} : { primary: commands.primary })}
        />
    )
}

/**
 * The overview as panes: the head with its commands, the canvas of cards, and the "needs you" side pane (a docked pane from
 * 70rem, a drawer below it).
 */
export const OverviewPaneBase = (props: OverviewPaneBaseProps) => {
    const view = props.props
    const { copy } = view
    const ready = "items" in view.slot ? view.slot.items : null
    const primary = commandsOf(props, ready).primary
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="head" surface>
                    <Head view={props} ready={ready} />
                </Pane>
                <Pane area="main" scroll label={copy.main}>
                    <PaneBody {...(primary === undefined ? {} : { phonePrimary: primary })}>
                        <SlotView
                            slot={view.slot}
                            placeholder={view.placeholder}
                            labels={view.labels}
                            errorDescription={copy.errorBody}
                            onRetry={props.on.retry}
                            render={(data, loading) => <MainSections data={data} view={props} isLoading={loading} />}
                        />
                    </PaneBody>
                </Pane>
                <Pane area="asideHead" surface>
                    <PaneHead title={copy.asideTitle} />
                </Pane>
                <Pane
                    area="aside"
                    surface
                    scroll
                    label={copy.asideTitle}
                    collapse="drawer"
                    collapseLabel={copy.asideTitle}
                    openLabel={`${copy.asideOpen} (${ready === null ? 0 : ready.pending})`}
                    closeLabel={copy.asideClose}
                    isOpen={view.isAsideOpen}
                    onOpenChange={props.on.asideOpenChange}
                >
                    <PaneBody>
                        {"isError" in view.slot ? null : (
                            <SlotView
                                slot={view.slot}
                                placeholder={view.placeholder}
                                labels={view.labels}
                                forbidden="hide"
                                onRetry={props.on.retry}
                                render={(data, loading) => (
                                    <>
                                        <OverviewAsideWaiting data={data} copy={copy} isLoading={loading} />
                                        <OverviewAsideLists data={data} copy={copy} isLoading={loading} />
                                    </>
                                )}
                            />
                        )}
                    </PaneBody>
                </Pane>
            </PaneGrid>
        </Page>
    )
}

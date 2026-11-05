import type { BookingWorkbenchDataView, BookingWorkbenchActions } from "@/modules/types"
import type { ReactNode, ReactElement } from "react"
import { Stack } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { BookingSetupSection } from "@/components/frames/BookingSetupSection"
import { BookingDesk } from "@/components/frames/BookingDesk"
import { BookingStats } from "@/components/frames/BookingStats"
import { BookingServices } from "@/components/frames/BookingServices"
import { BookingResources } from "@/components/frames/BookingResources"
import { BookingExceptions } from "@/components/frames/BookingExceptions"
import { BookingPolicyForm } from "@/components/composites/BookingPolicyForm"
import { BookingPublicPageForm } from "@/components/composites/BookingPublicPageForm"
import { BookingWaitlist } from "@/components/composites/BookingWaitlist"
import { WorkbenchOverview } from "@/components/frames/WorkbenchOverview"
/** The five booking panels, each a tab of the one workbench. */
type BookingWorkbenchShape = "calendar" | "today" | "waitlist" | "stats" | "setup"
/** Plain booking models and commands; only this module Base renders their canonical read status. */
export interface BookingWorkbenchBaseProps {
    readonly shape: BookingWorkbenchShape
    readonly props: BookingWorkbenchDataView
    readonly on: BookingWorkbenchActions
}
/** What a panel reads: the view and the commands of the workbench. */
type PanelProps = Pick<BookingWorkbenchBaseProps, "props" | "on">
const DeskPanel = (props: PanelProps) => (
    <SlotView
        {...props.props.desk}
        onRetry={props.on.retryDesk}
        render={(view, isLoading) => <BookingDesk {...view} {...props.on.desk} isLoading={isLoading} />}
    />
)
type SetupData = BookingWorkbenchDataView["panel"]["placeholder"]["setup"]
type SetupKey = keyof SetupData
/** The setup regions in the order the tab draws them, each with the form it holds. */
const SETUP_REGIONS: ReadonlyArray<SetupKey> = ["services", "resources", "exceptions", "policy", "publicPage"]
const SETUP_FORMS: Record<
    SetupKey,
    (setup: SetupData, on: BookingWorkbenchActions["setup"], isLoading: boolean) => ReactNode
> = {
    services: (setup, on, isLoading) => <BookingServices {...setup.services} {...on.services} isLoading={isLoading} />,
    resources: (setup, on, isLoading) => (
        <BookingResources {...setup.resources} {...on.resources} isLoading={isLoading} />
    ),
    exceptions: (setup, on, isLoading) => (
        <BookingExceptions {...setup.exceptions} {...on.exceptions} isLoading={isLoading} />
    ),
    policy: (setup, on, isLoading) => <BookingPolicyForm {...setup.policy} {...on.policy} isLoading={isLoading} />,
    publicPage: (setup, on, isLoading) => (
        <BookingPublicPageForm {...setup.publicPage} {...on.publicPage} isLoading={isLoading} />
    ),
}
const SetupPanel = (props: PanelProps) => (
    <Stack gap="section">
        {SETUP_REGIONS.map((region) => (
            <SlotView
                key={region}
                {...props.props.panel}
                onRetry={props.on.retryPanel}
                render={(panel, isLoading) => (
                    <BookingSetupSection title={panel.setup[region].title} hint={panel.setup[region].hint}>
                        {SETUP_FORMS[region](panel.setup, props.on.setup, isLoading)}
                    </BookingSetupSection>
                )}
            />
        ))}
    </Stack>
)
const ModulePanel = (props: BookingWorkbenchBaseProps) => {
    switch (props.shape) {
        case "calendar":
        case "today":
            return <DeskPanel props={props.props} on={props.on} />
        case "setup":
            return <SetupPanel props={props.props} on={props.on} />
        case "waitlist":
            return (
                <SlotView
                    {...props.props.panel}
                    onRetry={props.on.retryPanel}
                    render={(panel, isLoading) => (
                        <BookingWaitlist {...panel.waitlist} {...props.on.waitlist} isLoading={isLoading} />
                    )}
                />
            )
        case "stats":
            return (
                <SlotView
                    {...props.props.panel}
                    onRetry={props.on.retryPanel}
                    render={(panel, isLoading) => <BookingStats {...panel.stats} isLoading={isLoading} />}
                />
            )
    }
}
/** The booking workbench: the tabs and the chosen panel beside the decisions, or beside the explanation of one. */
export const BookingWorkbenchBase = (props: BookingWorkbenchBaseProps): ReactElement => {
    const view = props.props
    return (
        <WorkbenchOverview
            view={view}
            ribbon={view.ribbon}
            on={props.on}
            aside={{ view: view.aside, on: props.on.aside }}
            forbidden="notice"
        >
            <ModulePanel {...props} />
        </WorkbenchOverview>
    )
}

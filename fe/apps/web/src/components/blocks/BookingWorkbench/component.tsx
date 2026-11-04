import { type BookingWorkbenchDataView, type BookingWorkbenchActions, BOOKING_TABS } from "@/modules/types"
import type { ReactNode, ReactElement } from "react"
import { Stack } from "@starci/grammar/common"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
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
/** The five real booking panels and the recorded-explanation arrangement. */
export const BOOKING_WORKBENCH_SHAPES: readonly [...typeof BOOKING_TABS, "explanation"] = [
    ...BOOKING_TABS,
    "explanation",
]
type BookingWorkbenchShape = (typeof BOOKING_WORKBENCH_SHAPES)[number]
/** Plain booking models and commands; only this module Base renders their canonical read status. */
export interface BookingWorkbenchBaseProps {
    readonly shape: BookingWorkbenchShape
    readonly props: BookingWorkbenchDataView
    readonly on: BookingWorkbenchActions
}
const DeskPanel = (props: Omit<BookingWorkbenchBaseProps, "shape">) => (
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
const SetupPanel = (props: Omit<BookingWorkbenchBaseProps, "shape">) => (
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
        case "explanation":
            return null
    }
}
const Overview = (props: BookingWorkbenchBaseProps) => {
    const view = props.props
    return (
        <WorkbenchOverview view={view} ribbon={view.ribbon} on={props.on} forbidden="notice">
            <ModulePanel {...props} />
        </WorkbenchOverview>
    )
}
const Explanation = (props: Omit<BookingWorkbenchBaseProps, "shape">) => {
    const view = props.props,
        why = view.why
    return (
        <WorkbenchWhyFrame
            label={why.paneLabel}
            listLabel={why.listLabel}
            openLabel={why.openLabel}
            closeLabel={why.closeLabel}
            view={why.view}
            labels={why.labels}
            onClose={props.on.closeWhy}
        >
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.waiting.label}
                        rows={waiting.rows}
                        openLabel={waiting.openLabel}
                        isLoading={isLoading}
                    />
                )}
            />
            <SlotView
                {...view.regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.done.label}
                        rows={done.rows}
                        openLabel={null}
                        isLoading={isLoading}
                    />
                )}
            />
        </WorkbenchWhyFrame>
    )
}
/** Draws actual booking panels and the original overview/why layouts; statuses never become shapes. */
export const BookingWorkbenchBase = (props: BookingWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "calendar":
        case "today":
        case "waitlist":
        case "stats":
        case "setup":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}

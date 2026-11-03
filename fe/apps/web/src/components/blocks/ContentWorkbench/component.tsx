import type { ReactElement } from "react"
import { CONTENT_TABS, type ContentViews, type ContentActions } from "@/modules/types"
import { Alert, Cluster, Grid, Stack } from "@starci/grammar/common"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { ContentSettingsCard } from "@/components/frames/ContentSettingsCard"
import { ContentPostEditorView } from "@/components/frames/ContentPostEditorView"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { SlotView } from "@/components/composites/SlotView"
import { WorkbenchOverviewTop } from "@/components/frames/WorkbenchOverviewTop"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { ContentAddPostControls } from "@/components/composites/ContentAddPostControls"
import { ContentQuickIdeaControls } from "@/components/composites/ContentQuickIdeaControls"
import { ContentPlanControls } from "@/components/composites/ContentPlanControls"
import { ContentCalendarView } from "@/components/composites/ContentCalendarView"
import { ContentPostList } from "@/components/composites/ContentPostList"
import { ContentQueueView } from "@/components/composites/ContentQueueView"
import { ContentBalanceView } from "@/components/composites/ContentBalanceView"
import { ContentPillarSettings } from "@/components/composites/ContentPillarSettings"
import { ContentCadenceSettings } from "@/components/composites/ContentCadenceSettings"
import { ContentBrandSettings } from "@/components/composites/ContentBrandSettings"
import { ContentAutomationSettings } from "@/components/composites/ContentAutomationSettings"

/** Only actual content tabs and the recorded-explanation arrangement are shapes. */
export const CONTENT_WORKBENCH_SHAPES: readonly [...typeof CONTENT_TABS, "explanation"] = [...CONTENT_TABS, "explanation"]
type ContentShape = (typeof CONTENT_WORKBENCH_SHAPES)[number]

/** One Content world, resolved atomic data slots and commands. */
export interface ContentWorkbenchBaseProps {
    readonly shape: ContentShape
    readonly props: ContentViews["workbenchFields"]
    readonly on: ContentActions["workbenchActions"]
}
type Panel = ContentViews["workbenchPanel"]
interface PanelProps {
    readonly data: Panel | null
    readonly copy: ContentViews["workbenchCopy"]
    readonly loading: ContentViews["workbenchFields"]["loading"]
    readonly on: ContentActions["workbenchActions"]
    readonly shape: ContentShape
    readonly isLoading: boolean
}

const Settings = ({ copy, data, on, isLoading }: Pick<PanelProps, "copy" | "data" | "on" | "isLoading">) => {
    const settings = data?.settings
    const blank = { copy, canManage: false, isPending: false, note: null }
    return (
        <>
            {data !== null && !data.canManage ? <Alert title={data.readOnly} tone="informative" /> : null}
            <ContentSettingsCard title={copy.settingsPillars} description={copy.settingsPillarsBody}>
                <ContentPillarSettings
                    {...(settings?.pillars ?? { ...blank, rows: [] })}
                    on={on.settings.pillars}
                    isLoading={isLoading}
                />
            </ContentSettingsCard>
            <ContentSettingsCard title={copy.settingsCadence} description={copy.settingsCadenceBody}>
                <ContentCadenceSettings
                    {...(settings?.cadence ?? { ...blank, rows: [], dayNames: [] })}
                    on={on.settings.cadence}
                    isLoading={isLoading}
                />
            </ContentSettingsCard>
            <ContentBrandSettings
                {...(settings?.brand ?? { ...blank, voice: "", avoid: "", cta: "", tags: "" })}
                on={on.settings.brand}
                isLoading={isLoading}
            />
            <ContentAutomationSettings
                {...(settings?.automation ?? { ...blank, rows: [] })}
                on={on.settings.automation}
                isLoading={isLoading}
            />
        </>
    )
}

const ReadyPanel = (props: PanelProps) => {
    const data = props.data?.panels
    const on = props.on.panels
    const copy = props.copy
    switch (props.shape) {
        case "calendar":
            return (
                <ContentCalendarView
                    {...(data?.calendar ?? {
                        copy,
                        ...props.loading.calendar,
                        cells: [],
                        monthItems: [],
                        isMonthEmpty: false,
                        unscheduled: [],
                        pickedId: null,
                        overKey: null,
                        expandedKey: null,
                        canManage: false,
                        isEmptySetup: false,
                        note: null,
                    })}
                    on={on.calendar}
                    isLoading={props.isLoading}
                />
            )
        case "list":
            return (
                <ContentPostList
                    {...(data?.list ?? { copy, shown: [], isEmpty: false, filters: [], filter: "all" })}
                    on={on.list}
                    isLoading={props.isLoading}
                />
            )
        case "queue":
            return (
                <ContentQueueView
                    {...(data?.queue ?? {
                        copy,
                        waiting: [],
                        ready: [],
                        canDecide: false,
                        isPending: false,
                        busy: null,
                        notes: {},
                    })}
                    on={on.queue}
                    isLoading={props.isLoading}
                />
            )
        case "balance":
            return (
                <ContentBalanceView
                    {...(data?.balance ?? { copy, ...props.loading.balance, themes: [], channels: [] })}
                    on={on.balance}
                    isLoading={props.isLoading}
                />
            )
        case "settings":
            return <Settings copy={props.copy} data={props.data} on={props.on} isLoading={props.isLoading} />
        case "explanation":
            return null
    }
}

const ModulePanel = (props: ContentWorkbenchBaseProps) => (
    <SlotView<Panel | null>
        {...props.props.panel}
        placeholder={null}
        onRetry={props.on.retry}
        render={(data, isLoading) => (
            <Stack gap="row">
                {data?.canManage ? (
                    <ContentPlanControls {...data.commands.plan} on={props.on.commands.plan} isLoading={isLoading} />
                ) : null}
                {data?.canManage && (props.shape === "calendar" || props.shape === "list") ? (
                    <Cluster gap="inline">
                        <ContentQuickIdeaControls
                            {...data.commands.quick}
                            on={props.on.commands.quick}
                            isLoading={isLoading}
                        />
                        <ContentAddPostControls
                            {...data.commands.add}
                            on={props.on.commands.add}
                            isLoading={isLoading}
                        />
                    </Cluster>
                ) : null}
                <ReadyPanel
                    data={data}
                    copy={props.props.copy}
                    loading={props.props.loading}
                    on={props.on}
                    shape={props.shape}
                    isLoading={isLoading}
                />
            </Stack>
        )}
    />
)

const DashboardCards = (props: Pick<ContentWorkbenchBaseProps, "props" | "on">) => {
    const regions = props.props.regions
    return (
        <Grid kind="cards" columns={3}>
            <SlotView
                {...regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <DoneRegion label={regions.done.label} view={done} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.connections}
                onRetry={props.on.retryDashboard}
                render={(connections, isLoading) => (
                    <ConnectionsRegion label={regions.connections.label} view={connections} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.knowledge}
                onRetry={props.on.retryDashboard}
                render={(knowledge, isLoading) => (
                    <KnowledgeRegion label={regions.knowledge.label} view={knowledge} isLoading={isLoading} />
                )}
            />
        </Grid>
    )
}

const Overview = (props: ContentWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <WorkbenchOverviewTop view={view} on={{ ...props.on, retryRibbon: props.on.retry }}>
                <ModulePanel shape={props.shape} props={props.props} on={props.on} />
            </WorkbenchOverviewTop>
            <DashboardCards {...props} />
            {view.editor === null ? null : <ContentPostEditorView {...view.editor} on={props.on.editor} />}
        </Stack>
    )
}

const Explanation = (props: Pick<ContentWorkbenchBaseProps, "props" | "on">) => {
    const view = props.props
    const why = view.why
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

/** Keeps data-status recipes in the world Base and every lower drawing below its lawful tier. */
export const ContentWorkbenchBase = (props: ContentWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "calendar":
        case "list":
        case "queue":
        case "balance":
        case "settings":
            return <Overview {...props} />
        case "explanation":
            return <Explanation {...props} />
    }
}

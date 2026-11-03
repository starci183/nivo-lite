import type { ReactElement } from "react"
import { VIDEO_EDITOR_STEPS, type VideoWorkbenchActions, type VideoWorkbenchViews } from "@/modules/types"
type VideoWorkbenchFields = VideoWorkbenchViews["fields"]
type VideoEditorPanelFields = VideoWorkbenchViews["editorPanel"]
type VideoNormalPanelFields = VideoWorkbenchViews["normalPanel"]

import { Button, Grid, Stack } from "@starci/grammar/common"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { WorkbenchOverviewTop } from "@/components/frames/WorkbenchOverviewTop"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { VideoGoalForm } from "@/components/composites/VideoGoalForm"
import { VideoInputsForm } from "@/components/composites/VideoInputsForm"
import { VideoBrandSettings } from "@/components/composites/VideoBrandSettings"
import { VideoScriptForm, VIDEO_SCRIPT_FORM_READ_DEFAULTS } from "@/components/composites/VideoScriptForm"
import { VideoEditSteps } from "@/components/composites/VideoEditSteps"
import { VideoPreviewCard, VIDEO_PREVIEW_CARD_READ_DEFAULTS } from "@/components/composites/VideoPreviewCard"
import { VideoResultView, VIDEO_RESULT_VIEW_READ_DEFAULTS } from "@/components/composites/VideoResultView"
import { VideoLibraryList } from "@/components/composites/VideoLibraryList"
/** The approved normal, five editor and explanation drawings remain exhaustive. */
export const VIDEO_WORKBENCH_SHAPES: readonly ["library", "brand", ...typeof VIDEO_EDITOR_STEPS, "explanation"] = ["library", "brand", ...VIDEO_EDITOR_STEPS, "explanation"]
type Shape = (typeof VIDEO_WORKBENCH_SHAPES)[number]
/** One pure Video drawing takes real read slots, separate local/copy atoms and actions. */
export type VideoWorkbenchBaseProps = VideoWorkbenchViews["view"]
/** Native missing-read facts only: no Project, brand record, business row, or selected count. */
const NORMAL_READ_MISSING: VideoNormalPanelFields = {
    library: { meta: "", entries: [], canEdit: false, isViewOnly: false },
    brand: { logoUrl: null, canEdit: false },
    canCreate: false,
}
const EDITOR_READ_MISSING: VideoEditorPanelFields = {
    stepper: { current: "goal", hasProject: false, isViewOnly: false },
    goal: { disabled: true },
    inputs: { sources: [], media: [], canEdit: false },
    brand: { logoUrl: null, canEdit: false },
    script: null,
    preview: null,
    result: null,
}

interface EditorProps {
    readonly shape: Shape
    readonly ui: VideoWorkbenchFields["ui"]
    readonly data: VideoEditorPanelFields
    readonly isLoading: boolean
    readonly on: VideoWorkbenchActions
}
const EditorStep = (props: EditorProps) => {
    const p = props.data,
        ui = props.ui
    switch (props.shape) {
        case "goal":
            return <VideoGoalForm {...ui.goal} {...p.goal} isLoading={props.isLoading} on={props.on.goal} />
        case "inputs":
            return (
                <>
                    <VideoInputsForm
                        {...ui.inputs}
                        {...p.inputs}
                        media={p.inputs.media.map((tile) => ({ ...tile, selected: ui.mediaPaths.includes(tile.path) }))}
                        isLoading={props.isLoading}
                        on={props.on.inputs}
                    />
                    <VideoBrandSettings {...ui.brand} {...p.brand} isLoading={props.isLoading} on={props.on.brand} />
                </>
            )
        case "script": {
            const { isScripting, jobState, projectFailure, ...facts } = p.script ?? VIDEO_SCRIPT_FORM_READ_DEFAULTS
            const writing =
                isScripting ||
                ui.scriptRequestPending ||
                (jobState !== null && !["succeeded", "failed"].includes(jobState))
            return (
                <VideoScriptForm
                    {...ui.script}
                    {...facts}
                    writing={writing}
                    locked={!facts.canEdit || writing}
                    mediaOptions={[{ id: "none", label: ui.mediaNoneLabel }, ...facts.mediaOptions]}
                    error={ui.script.error ?? projectFailure}
                    isLoading={props.isLoading}
                    on={props.on.script}
                />
            )
        }
        case "preview": {
            const { hasRender, statusFailure, ...facts } = p.preview ?? VIDEO_PREVIEW_CARD_READ_DEFAULTS
            return (
                <VideoPreviewCard
                    {...ui.preview}
                    {...facts}
                    renderLabel={hasRender ? ui.rerenderLabel : ui.preview.renderLabel}
                    pending={ui.preview.pending || facts.live}
                    error={ui.preview.error ?? statusFailure}
                    isLoading={props.isLoading}
                    on={props.on.preview}
                />
            )
        }
        case "result": {
            const { isApproved, hasFailedRender, ...facts } = p.result ?? VIDEO_RESULT_VIEW_READ_DEFAULTS
            return (
                <VideoResultView
                    {...ui.result}
                    {...facts}
                    approveHeading={isApproved ? ui.approvedHeadingLabel : ui.result.approveHeading}
                    approveHelp={isApproved ? null : ui.result.approveHelp}
                    lockedNote={isApproved ? ui.result.lockedNote : null}
                    failedTitle={hasFailedRender ? ui.result.failedTitle : null}
                    isLoading={props.isLoading}
                    on={props.on.result}
                />
            )
        }
        case "library":
        case "brand":
        case "explanation":
            return null
    }
}
const Editor = (props: VideoWorkbenchBaseProps) => (
    <SlotView
        {...props.props.editor}
        placeholder={{ ...EDITOR_READ_MISSING, stepper: { ...EDITOR_READ_MISSING.stepper, current: props.shape } }}
        errorDescription={props.props.loadFailedBody}
        onRetry={props.on.retryEditor}
        render={(data, isLoading) => (
            <>
                <VideoEditSteps
                    {...props.props.ui.stepper}
                    current={data.stepper.current}
                    viewOnly={data.stepper.isViewOnly ? props.props.ui.viewOnlyLabel : null}
                    steps={props.props.ui.stepper.steps.map((step) => ({
                        ...step,
                        isDisabled: step.id !== "goal" && !data.stepper.hasProject,
                    }))}
                    isLoading={isLoading}
                    on={props.on.stepper}
                />
                <EditorStep shape={props.shape} data={data} ui={props.props.ui} isLoading={isLoading} on={props.on} />
            </>
        )}
    />
)
type NormalProps = Omit<EditorProps, "data"> & { readonly data: VideoNormalPanelFields }
const Normal = (props: NormalProps) => {
    switch (props.shape) {
        case "brand":
            return (
                <VideoBrandSettings
                    {...props.ui.brand}
                    {...props.data.brand}
                    isLoading={props.isLoading}
                    on={props.on.brand}
                />
            )
        case "library":
            return (
                <Stack gap="section">
                    {props.data.canCreate ? (
                        <Button intent="commit" href={props.ui.createHref} isLoading={props.isLoading}>
                            {props.ui.createLabel}
                        </Button>
                    ) : null}
                    <VideoLibraryList
                        {...props.ui.library}
                        meta={props.data.library.meta}
                        entries={props.data.library.entries}
                        canEdit={props.data.library.canEdit}
                        viewOnly={props.data.library.isViewOnly ? props.ui.viewOnlyLabel : null}
                        isLoading={props.isLoading}
                        on={props.on.library}
                    />
                </Stack>
            )
        case "goal":
        case "inputs":
        case "script":
        case "preview":
        case "result":
        case "explanation":
            return null
    }
}
const DashboardCards = (props: VideoWorkbenchBaseProps) => {
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
const Explanation = (props: VideoWorkbenchBaseProps) => {
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
const Overview = (props: VideoWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <WorkbenchOverviewTop view={view} on={{ ...props.on, retryRibbon: props.on.retryFigures }}>
                <SlotView
                    {...view.normal}
                    placeholder={NORMAL_READ_MISSING}
                    errorDescription={view.loadFailedBody}
                    onRetry={props.on.retryNormal}
                    render={(data, isLoading) => (
                        <Normal data={data} ui={view.ui} shape={props.shape} isLoading={isLoading} on={props.on} />
                    )}
                />
            </WorkbenchOverviewTop>
            <DashboardCards {...props} />
        </Stack>
    )
}
/** The original editor bypasses the normal dashboard; every actual read keeps its own status recipe. */
export const VideoWorkbenchBase = (props: VideoWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "library":
        case "brand":
            return <Overview {...props} />
        case "goal":
        case "inputs":
        case "script":
        case "preview":
        case "result":
            return <Editor {...props} />
        case "explanation":
            return <Explanation {...props} />
    }
}

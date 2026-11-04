import type { ReactElement } from "react"
import { HIRING_TABS, type HiringViews, type HiringActions } from "@/modules/types"

import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { HiringCandidateFrame } from "@/components/frames/HiringCandidateFrame"
import { HiringJobList } from "@/components/composites/HiringJobList"
import { HiringJobEditorDialog } from "@/components/composites/HiringJobEditorDialog"
import { HiringJobAdDialog } from "@/components/composites/HiringJobAdDialog"
import { HiringPipelineBoard } from "@/components/composites/HiringPipelineBoard"
import { HiringRejectDialog } from "@/components/composites/HiringRejectDialog"
import { HiringInterviewSchedule } from "@/components/composites/HiringInterviewSchedule"
import { HiringOfferList } from "@/components/composites/HiringOfferList"
import { HiringOnboardingList } from "@/components/composites/HiringOnboardingList"
import { HiringWorkbenchSettings } from "@/components/composites/HiringWorkbenchSettings"
import { HiringAvailabilitySettings } from "@/components/composites/HiringAvailabilitySettings"
import { HiringCvSection } from "@/components/composites/HiringCvSection"
import { HiringInterviewDialog } from "@/components/composites/HiringInterviewDialog"
import { HiringOfferDialog } from "@/components/composites/HiringOfferDialog"
import { HiringCandidateHistory } from "@/components/leaves/HiringCandidateHistory"
import { WorkbenchOverview } from "@/components/frames/WorkbenchOverview"

/** Existing real panel arrangements and the recorded-explanation arrangement. */
export const HIRING_WORKBENCH_SHAPES: readonly [...typeof HIRING_TABS, "explanation"] = [...HIRING_TABS, "explanation"]
type Shape = (typeof HIRING_WORKBENCH_SHAPES)[number]
/** One world, plain read models and atomic actions only. */
export interface HiringWorkbenchBaseProps {
    readonly shape: Shape
    readonly props: HiringViews["workbenchFields"]
    readonly on: HiringActions["workbenchActions"]
}
type Panel = HiringViews["workbenchPanel"]
interface PanelProps {
    readonly data: Panel
    readonly shape: Shape
    readonly on: HiringActions["workbenchActions"]
    readonly isLoading: boolean
}

const Jobs = (props: Pick<PanelProps, "data" | "on" | "isLoading">) => {
    const p = props.data.panels.jobs,
        on = props.on.panels.jobs
    return (
        <>
            <HiringJobList {...p} on={on.list} isLoading={props.isLoading} />
            {p.isEditorOpen ? <HiringJobEditorDialog {...p.editor} on={on.editor} /> : null}
            {p.isAdOpen ? <HiringJobAdDialog {...p.ad} on={on.ad} /> : null}
        </>
    )
}
const Pipeline = (props: Pick<PanelProps, "data" | "on" | "isLoading">) => {
    const p = props.data.panels.pipeline,
        on = props.on.panels.pipeline
    return (
        <>
            <HiringPipelineBoard {...p} on={on.board} isLoading={props.isLoading} />
            {p.isRejectOpen ? <HiringRejectDialog props={p.reject} on={on.reject} /> : null}
        </>
    )
}
const ReadyPanel = (props: PanelProps) => {
    const p = props.data,
        on = props.on
    switch (props.shape) {
        case "jobs":
            return <Jobs {...props} />
        case "candidates":
            return <Pipeline {...props} />
        case "interviews":
            return (
                <HiringInterviewSchedule
                    {...p.panels.interviews}
                    on={on.panels.interviews}
                    isLoading={props.isLoading}
                />
            )
        case "offers":
            return <HiringOfferList {...p.panels.offers} on={on.panels.offers} isLoading={props.isLoading} />
        case "onboarding":
            return (
                <HiringOnboardingList {...p.panels.onboarding} on={on.panels.onboarding} isLoading={props.isLoading} />
            )
        case "settings":
            return (
                <>
                    <HiringWorkbenchSettings
                        {...p.settings.settings}
                        on={on.settings.settings}
                        isLoading={props.isLoading}
                    />
                    <HiringAvailabilitySettings
                        {...p.settings.availability}
                        on={on.settings.availability}
                        isLoading={props.isLoading}
                    />
                </>
            )
        case "explanation":
            return null
    }
}
const ModulePanel = (props: HiringWorkbenchBaseProps) => (
    <SlotView
        {...props.props.panel}
        onRetry={props.on.retry}
        render={(data, isLoading) => <ReadyPanel data={data} shape={props.shape} on={props.on} isLoading={isLoading} />}
    />
)

const CV_PLACEHOLDER = { hasCv: true, openLabel: "", url: "", isPdf: false, canPreview: false, isPreviewing: false }
const CandidateDialogs = (props: Pick<HiringWorkbenchBaseProps, "props" | "on">) => {
    const p = props.props.candidate,
        on = props.on.candidate.dialogs
    return (
        <>
            {p.dialog === "interview" ? <HiringInterviewDialog {...p.dialogs.interview} on={on.interview} /> : null}
            {p.dialog === "offer" ? <HiringOfferDialog {...p.dialogs.offer} on={on.offer} /> : null}
            {p.dialog === "reject" ? <HiringRejectDialog props={p.dialogs.reject} on={on.reject} /> : null}
        </>
    )
}
const Candidate = (props: Pick<HiringWorkbenchBaseProps, "props" | "on">) => {
    const p = props.props.candidate,
        on = props.on.candidate,
        copy = p.frame.copy
    return (
        <HiringCandidateFrame
            {...p.frame}
            on={on.frame}
            dialogs={<CandidateDialogs {...props} />}
            cv={
                p.hasNoCv ? (
                    <HiringCvSection
                        {...CV_PLACEHOLDER}
                        copy={copy}
                        hasCv={false}
                        isLoading={false}
                        on={{ toggle: on.toggleCv }}
                    />
                ) : (
                    <SlotView
                        {...p.cv}
                        placeholder={CV_PLACEHOLDER}
                        onRetry={on.retryDetail}
                        render={(cv, isLoading) => (
                            <HiringCvSection {...cv} copy={copy} isLoading={isLoading} on={{ toggle: on.toggleCv }} />
                        )}
                    />
                )
            }
            history={
                <SlotView
                    {...p.history}
                    placeholder={[]}
                    onRetry={on.retryDetail}
                    render={(items, isLoading) => (
                        <HiringCandidateHistory items={items} loadingLabel={copy.loading} isLoading={isLoading} />
                    )}
                />
            }
        />
    )
}

const Overview = (props: HiringWorkbenchBaseProps) => {
    const view = props.props
    return (
        <WorkbenchOverview
            view={view}
            ribbon={view.ribbon}
            on={{ ...props.on, retryRibbon: props.on.retry }}
            after={<Candidate {...props} />}
        >
            <ModulePanel shape={props.shape} props={props.props} on={props.on} />
        </WorkbenchOverview>
    )
}

const Explanation = (props: Pick<HiringWorkbenchBaseProps, "props" | "on">) => {
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

/** Status recipes remain in the one module Base; ordinary ready drawings stay downward. */
export const HiringWorkbenchBase = (props: HiringWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "jobs":
        case "candidates":
        case "interviews":
        case "offers":
        case "onboarding":
        case "settings":
            return <Overview {...props} />
        case "explanation":
            return <Explanation {...props} />
    }
}

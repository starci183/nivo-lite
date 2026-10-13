import type { ComponentProps, ReactNode } from "react"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { VideoBrandCard } from "@/components/blocks/VideoBrandCard"
import { VideoEditorStepper } from "@/components/blocks/VideoEditorStepper"
import { VideoRibbon } from "@/components/blocks/VideoRibbon"
import { VideoGoalStep } from "@/components/blocks/VideoGoalStep"
import { VideoInputsStep } from "@/components/blocks/VideoInputsStep"
import { VideoLibrary } from "@/components/blocks/VideoLibrary"
import { VideoLibraryGate } from "@/components/blocks/VideoLibraryGate"
import { VideoNewLink } from "@/components/blocks/VideoNewLink"
import { VideoPreviewStep } from "@/components/blocks/VideoPreviewStep"
import { VideoResultStep } from "@/components/blocks/VideoResultStep"
import { VideoScriptStep } from "@/components/blocks/VideoScriptStep"
import { VideoStepGate } from "@/components/blocks/VideoStepGate"
import { VideoWorkbenchStatus } from "@/components/blocks/VideoWorkbenchStatus"
import { PANEL_CLASS_NAME } from "./classNames"

/** The step a part of the wizard belongs to. */
type VideoStepScope = ComponentProps<typeof VideoStepGate>["scope"]

/** What the video workbench page draws. */
export interface VideoWorkbenchPageBaseProps {
    readonly props: {
        /** The agent instance the workbench opened for. */
        readonly installationId: string | null
        /** The tab (library view) or the wizard step named in the address. */
        readonly tab: string | null
        /** The video named in the address, or the new-video command; set when the wizard is open. */
        readonly focus: string | null
        /** Whether the wizard is open instead of the library. */
        readonly isEditor: boolean
        readonly tabs: { readonly library: string; readonly brand: string }
    }
}

/** The parts of the wizard in order, each behind the gate of its step. */
const STEPS: ReadonlyArray<{
    readonly scope: VideoStepScope
    readonly draw: (tab: string | null, focus: string | null) => ReactNode
}> = [
    { scope: "stepper", draw: (tab, focus) => <VideoEditorStepper tab={tab} focus={focus} /> },
    { scope: "goal", draw: (tab, focus) => <VideoGoalStep tab={tab} focus={focus} /> },
    {
        scope: "inputs",
        draw: (tab, focus) => (
            <>
                <VideoInputsStep tab={tab} focus={focus} />
                <VideoBrandCard />
            </>
        ),
    },
    { scope: "script", draw: (tab, focus) => <VideoScriptStep tab={tab} focus={focus} /> },
    { scope: "preview", draw: (tab, focus) => <VideoPreviewStep tab={tab} focus={focus} /> },
    { scope: "result", draw: (tab, focus) => <VideoResultStep tab={tab} focus={focus} /> },
]

/** Draws the video workbench: the wizard when a video is open, else the agent dashboard frame around the library and the brand kit. */
export const VideoWorkbenchPageBase = (props: VideoWorkbenchPageBaseProps) => {
    const { installationId, tab, focus, isEditor, tabs } = props.props
    if (isEditor) {
        return (
            <>
                <VideoWorkbenchStatus tab={tab} focus={focus} />
                {STEPS.map((step) => (
                    <VideoStepGate key={`${step.scope}:${focus}`} scope={step.scope} tab={tab} focus={focus}>
                        {step.draw(tab, focus)}
                    </VideoStepGate>
                ))}
            </>
        )
    }
    return (
        <AgentDashboardFrame
            module="video"
            installationId={installationId}
            initialTab={tab}
            ribbon={<VideoRibbon />}
            tabs={[
                {
                    id: "library",
                    label: tabs.library,
                    content: (
                        <div className={PANEL_CLASS_NAME}>
                            <VideoWorkbenchStatus tab={tab} focus={focus} />
                            <VideoLibraryGate placeholder={tabs.library}>
                                <VideoNewLink />
                                <VideoLibrary />
                            </VideoLibraryGate>
                        </div>
                    ),
                },
                {
                    id: "brand",
                    label: tabs.brand,
                    content: (
                        <VideoLibraryGate placeholder={tabs.brand}>
                            <VideoBrandCard />
                        </VideoLibraryGate>
                    ),
                },
            ]}
        />
    )
}

import { VideoBrandCard } from "@/components/blocks/VideoBrandCard"
import { VideoEditorStepper } from "@/components/blocks/VideoEditorStepper"
import { VideoGoalStep } from "@/components/blocks/VideoGoalStep"
import { VideoInputsStep } from "@/components/blocks/VideoInputsStep"
import { VideoLibrary } from "@/components/blocks/VideoLibrary"
import { VideoNewLink } from "@/components/blocks/VideoNewLink"
import { VideoPreviewStep } from "@/components/blocks/VideoPreviewStep"
import { VideoResultStep } from "@/components/blocks/VideoResultStep"
import { VideoScriptStep } from "@/components/blocks/VideoScriptStep"
import { VideoLibraryGate } from "@/components/blocks/VideoLibraryGate"
import { VideoStepGate } from "@/components/blocks/VideoStepGate"
import { VideoWorkbenchStatus } from "@/components/blocks/VideoWorkbenchStatus"
import { WorkbenchHeader } from "@/components/blocks/WorkbenchHeader"
import { workbenchPanelId } from "@/components/leaves/WorkbenchTabsNav"
import { FRAME_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** The tabs of the library view. */
export type VideoWorkbenchTab = "library" | "brand"

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
        /** The selected tab of the library view. */
        readonly libraryTab: VideoWorkbenchTab
    }
}

/** Draws the video workbench: the wizard when a video is open, else the library and the brand kit inside the shared header. */
export const VideoWorkbenchPageBase = (props: VideoWorkbenchPageBaseProps) => {
    const { installationId, tab, focus, isEditor, libraryTab } = props.props
    if (isEditor) {
        return (
            <>
                <VideoWorkbenchStatus tab={tab} focus={focus} />
                <VideoStepGate key={`stepper:${focus}`} scope="stepper" tab={tab} focus={focus}>
                    <VideoEditorStepper tab={tab} focus={focus} />
                </VideoStepGate>
                <VideoStepGate key={`goal:${focus}`} scope="goal" tab={tab} focus={focus}>
                    <VideoGoalStep tab={tab} focus={focus} />
                </VideoStepGate>
                <VideoStepGate key={`inputs:${focus}`} scope="inputs" tab={tab} focus={focus}>
                    <VideoInputsStep tab={tab} focus={focus} />
                    <VideoBrandCard />
                </VideoStepGate>
                <VideoStepGate key={`script:${focus}`} scope="script" tab={tab} focus={focus}>
                    <VideoScriptStep tab={tab} focus={focus} />
                </VideoStepGate>
                <VideoStepGate key={`preview:${focus}`} scope="preview" tab={tab} focus={focus}>
                    <VideoPreviewStep tab={tab} focus={focus} />
                </VideoStepGate>
                <VideoStepGate key={`result:${focus}`} scope="result" tab={tab} focus={focus}>
                    <VideoResultStep tab={tab} focus={focus} />
                </VideoStepGate>
            </>
        )
    }
    return (
        <div className={FRAME_CLASS_NAME}>
            <WorkbenchHeader module="video" installationId={installationId} tab={libraryTab} />
            <div className={PANEL_CLASS_NAME} role="tabpanel" id={workbenchPanelId(libraryTab)}>
                <VideoWorkbenchStatus tab={tab} focus={focus} />
                <VideoLibraryGate>
                    {libraryTab === "library" ? (
                        <>
                            <VideoNewLink />
                            <VideoLibrary />
                        </>
                    ) : (
                        <VideoBrandCard />
                    )}
                </VideoLibraryGate>
            </div>
        </div>
    )
}

"use client"

import { VIDEO_TABS, type VideoWorkbenchViews } from "@/modules/types"
type VideoWorkbenchInput = VideoWorkbenchViews["input"]
type VideoWorkbenchView = VideoWorkbenchViews["view"]
import { useTranslations } from "next-intl"
import { type VideoWorkbenchCopy, editorHref } from "@/modules/video"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useVideoEditor, useVideoLibrary } from "@/hooks/video"
import { mapSlot, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"

import { useGraphQLWithToast } from "@/modules/toast"
import { useVideoWorkbenchCopy } from "./useVideoWorkbenchCopy"
import { useVideoSourceViews } from "./useVideoSourceViews"
import { useVideoProductionViews } from "./useVideoProductionViews"
import { useVideoLibraryView } from "./useVideoLibraryView"
interface VideoRetryInput {
    readonly editor: ReturnType<typeof useVideoEditor>
    readonly production: ReturnType<typeof useVideoProductionViews>
    readonly library: ReturnType<typeof useVideoLibrary>
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly report: ReturnType<typeof useGraphQLWithToast>
}
/** The original new-video action belongs to the normal panel's actual permission. */
interface VideoPanelInput {
    readonly editor: ReturnType<typeof useVideoEditor>
    readonly library: ReturnType<typeof useVideoLibrary>
    readonly source: ReturnType<typeof useVideoSourceViews>
    readonly production: ReturnType<typeof useVideoProductionViews>
    readonly list: ReturnType<typeof useVideoLibraryView>
    readonly copy: VideoWorkbenchCopy
    readonly labels: ReturnType<typeof useSlotLabels>
}
/** Builds true read values only inside their ready folds; known copy and local controls remain separate. */
const videoPanelsOf = (context: VideoPanelInput) => {
    const { editor, library, source, production, list, copy, labels } = context
    return {
        ui: {
            ...source.ui,
            ...production.ui,
            library: list.ui,
            mediaNoneLabel: copy.mediaNone,
            rerenderLabel: copy.rerender,
            approvedHeadingLabel: copy.status_approved,
            viewOnlyLabel: copy.viewOnly,
            createLabel: copy.newVideo,
            createHref: editorHref("new", "goal"),
        },
        normal: {
            slot: mapSlot(library.slot, () => {
                if (list.read === null || source.read.brand === null)
                    throw new Error("A ready Video library requires its actual rows and brand facts")
                return { library: list.read, brand: source.read.brand, canCreate: list.read.canEdit }
            }),
            labels: { ...labels(copy.loadFailedBody), error: copy.loadFailedTitle },
        },
        editor: {
            slot: slotOfReads([...editor.reads, ...production.reads], () => {
                const { stepper, goal, inputs, brand } = source.read
                if (stepper === null || goal === null || inputs === null || brand === null)
                    throw new Error("A ready Video editor requires its actual source facts")
                return { stepper, goal, inputs, brand, ...production.read }
            }),
            labels: { ...labels(copy.loadFailedBody), error: copy.loadFailedTitle },
        },
    }
}
/** Retry exactly the reads of each independent Video region. */
const videoRetriesOf = (context: VideoRetryInput) => {
    const { editor, production, library, frame, report } = context
    const retryEditor = () => {
            Promise.all([editor.reload(), ...production.reads.map((read) => read.mutate())]).catch((error) =>
                report(() => Promise.reject(error), { showSuccessToast: false }),
            )
        },
        retryNormal = () => {
            library.reload().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        },
        retryFigures = () => {
            library.retryFigures().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        }
    return { retryEditor, retryNormal, retryFigures, retryDashboard: frame.reload }
}
/** One Video world owns true reads and controller lifetimes; the focus editor pauses its normal dashboard. */
export const useVideoWorkbenchView = (input: VideoWorkbenchInput): VideoWorkbenchView => {
    const ribbonWords = useTranslations("agentDashboard"),
        copy = useVideoWorkbenchCopy(),
        labels = useSlotLabels(),
        report = useGraphQLWithToast(),
        workspaceId = useWorkspaceId(),
        identity = JSON.stringify([workspaceId, input.installationId]),
        scope = input.isEditor ? JSON.stringify([identity, input.focus]) : identity,
        tabs = useAgentWorkbenchTabs({
            ids: VIDEO_TABS,
            initialTab: input.tab,
            isActive: !input.isEditor,
            scope: identity,
        }),
        frame = useAgentDashboardFrame({
            module: "video",
            installationId: input.installationId,
            hasOwnGaps: false,
            isActive: !input.isEditor,
        }),
        isActive = input.isEditor || frame.why.workItemId === null,
        editor = useVideoEditor(input, input.isEditor),
        library = useVideoLibrary(!input.isEditor && isActive)
    const step = editor.data?.step ?? editor.step,
        views = { editor: editor.data ?? null, library: library.data ?? null, copy, isActive, scope },
        source = useVideoSourceViews(views, input.isEditor, step, tabs.selected),
        production = useVideoProductionViews(views, input.isEditor, step),
        list = useVideoLibraryView({
            ...views,
            isActive: !input.isEditor && isActive && tabs.selected === "library" && library.data !== undefined,
        })
    const panels = videoPanelsOf({ editor, library, source, production, list, copy, labels })
    const { retryEditor, retryNormal, retryFigures, retryDashboard } = videoRetriesOf({
        editor,
        production,
        library,
        frame,
        report,
    })
    const surfaceShape = isActive ? tabs.selected : "explanation"
    return {
        shape: input.isEditor ? step : surfaceShape,
        props: {
            why: frame.why,
            loadFailedBody: copy.loadFailedBody,
            regions: frame.regions,
            ribbon: {
                slot: library.figuresSlot,
                placeholder: library.figures,
                label: ribbonWords("ribbonAria"),
                labels: { ...labels(copy.loadFailedBody), error: copy.loadFailedTitle },
            },
            ...panels,
            tabsLabel: frame.tabsLabel,
            selectedTab: tabs.selected,
            tabs: VIDEO_TABS.map((id) => ({ id, label: input.tabs[id] })),
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryEditor,
            retryNormal,
            retryFigures,
            retryDashboard,
            ...source.on,
            ...production.on,
            library: list.on,
        },
    }
}

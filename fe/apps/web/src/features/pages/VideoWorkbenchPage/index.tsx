import { getTranslations } from "next-intl/server"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { VideoBrandCard } from "@/components/blocks/VideoBrandCard"
import { VideoEditorStepper } from "@/components/blocks/VideoEditorStepper"
import { VideoGoalStep } from "@/components/blocks/VideoGoalStep"
import { VideoInputsStep } from "@/components/blocks/VideoInputsStep"
import { VideoLibrary } from "@/components/blocks/VideoLibrary"
import { VideoNewLink } from "@/components/blocks/VideoNewLink"
import { VideoPreviewStep } from "@/components/blocks/VideoPreviewStep"
import { VideoResultStep } from "@/components/blocks/VideoResultStep"
import { VideoScriptStep } from "@/components/blocks/VideoScriptStep"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import {
    readActiveWorkspace,
    readBrand,
    readFigures,
    readMedia,
    readProject,
    readProjects,
    readSources,
} from "@/modules/db"
import { goalTemplateOf, isUuid, stepFor } from "@/modules/video"
import type { EditorStep, ProjectView, VideoFigures } from "@/modules/video"
import { VideoWorkbenchPageBase } from "./component"

/** Props of the video workbench route. */
interface VideoWorkbenchPageProps {
    /** The tab named in the address: library or brand; while a video is open, the step of the wizard. */
    readonly tab?: string | null
    /** The video open in the wizard, or "new" for one that does not exist yet. */
    readonly focus?: string | null
}

const STEPS: ReadonlyArray<EditorStep> = ["goal", "inputs", "script", "preview", "result"]

/** The step the address names, else the one the video continues at; a video that does not exist yet starts at the goal. */
const stepOf = (tab: string | null | undefined, project: ProjectView | null): EditorStep => {
    if (project === null) return "goal"
    return STEPS.find((entry) => entry === tab) ?? stepFor(project.status, project.script.length)
}

/** The translator of the video namespace. */
type VideoTranslator = Awaited<ReturnType<typeof getTranslations>>

/** The four figures of the ribbon; none when they could not be read. */
const ribbonOf = (figures: VideoFigures | null, t: VideoTranslator): ReadonlyArray<DescriptionListStatItem> => {
    if (figures === null) return []
    return [
        {
            id: "rendering",
            term: t("figRendering"),
            description: String(figures.rendering),
            meta: t("figRenderingMeta", { n: figures.scripting }),
        },
        {
            id: "ready",
            term: t("figReady"),
            description: String(figures.readyToPublish),
            meta: t("figReadyMeta", { approved: figures.approved }),
        },
        {
            id: "published",
            term: t("figPublished"),
            description: String(figures.published30),
            meta: t("figPublishedMeta"),
        },
        {
            id: "credits",
            term: t("figCredits"),
            description: String(figures.credits30),
            meta: t("figCreditsMeta"),
        },
    ]
}

/** The video workbench (/agents/video/workbench): the library and the brand kit in the agent dashboard frame; one video opens in the wizard. */
export const VideoWorkbenchPage = async (props: VideoWorkbenchPageProps = {}) => {
    const t = await getTranslations("video")
    const dashboard = await loadAgentDashboard("video")
    const scope = await readActiveWorkspace()
    if (scope.kind !== "ok") {
        return (
            <VideoWorkbenchPageBase
                props={{ dashboard, tabLabel: t("tabVideos"), title: t("loadFailedTitle"), body: t("loadFailedBody") }}
            />
        )
    }
    const workspaceId = scope.value.id
    const canEdit = scope.value.role !== "staff"
    const [projects, brand, sources, media, figures] = await Promise.all([
        readProjects(workspaceId),
        readBrand(workspaceId),
        readSources(workspaceId),
        readMedia(workspaceId),
        readFigures(workspaceId),
    ])
    if (projects.kind !== "ok" || brand.kind !== "ok") {
        return (
            <VideoWorkbenchPageBase
                props={{ dashboard, tabLabel: t("tabVideos"), title: t("loadFailedTitle"), body: t("loadFailedBody") }}
            />
        )
    }
    const mediaItems = media.kind === "ok" ? media.value : []
    const focus = props.focus ?? null
    const opened = focus !== null && isUuid(focus) ? await readProject(workspaceId, focus) : null
    const project = opened?.kind === "ok" ? opened.value : null
    if (project !== null || focus === "new") {
        const step = stepOf(props.tab, project)
        const key = project === null ? "new" : `${project.id}:${project.updatedAt}`
        const first = goalTemplateOf(project?.goal ?? "service")
        return (
            <>
                <VideoEditorStepper projectId={project?.id ?? null} step={step} canEdit={canEdit} />
                {step === "goal" ? (
                    <VideoGoalStep
                        key={key}
                        projectId={project?.id ?? null}
                        goal={project?.goal ?? first.goal}
                        aspect={project?.aspect ?? first.default_aspect}
                        seconds={project?.targetSeconds ?? first.default_seconds}
                        title={project?.title ?? ""}
                        canEdit={canEdit}
                        locked={project?.status === "scripting" || project?.status === "rendering"}
                    />
                ) : null}
                {project !== null && step === "inputs" ? (
                    <>
                        <VideoInputsStep
                            key={key}
                            project={project}
                            sources={sources.kind === "ok" ? sources.value : []}
                            media={mediaItems}
                            canEdit={canEdit}
                        />
                        <VideoBrandCard brand={brand.value} media={mediaItems} canEdit={canEdit} />
                    </>
                ) : null}
                {project !== null && step === "script" ? (
                    <VideoScriptStep key={key} project={project} media={mediaItems} canEdit={canEdit} />
                ) : null}
                {project !== null && step === "preview" ? (
                    <VideoPreviewStep project={project} media={mediaItems} canEdit={canEdit} />
                ) : null}
                {project !== null && step === "result" ? <VideoResultStep project={project} canEdit={canEdit} /> : null}
            </>
        )
    }
    const ribbon = ribbonOf(figures.kind === "ok" ? figures.value : null, t)
    return (
        <AgentDashboardFrame
            module="video"
            data={dashboard}
            figures={ribbon}
            figuresFailed={figures.kind !== "ok"}
            command={canEdit ? <VideoNewLink /> : undefined}
            initialTab={props.tab ?? null}
            tabs={[
                {
                    id: "library",
                    label: t("tabVideos"),
                    content: <VideoLibrary projects={projects.value} canEdit={canEdit} />,
                },
                {
                    id: "brand",
                    label: t("tabBrand"),
                    content: <VideoBrandCard brand={brand.value} media={mediaItems} canEdit={canEdit} />,
                },
            ]}
        />
    )
}

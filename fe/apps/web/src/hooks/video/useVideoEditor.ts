"use client"

import { useMemo } from "react"
import { useQueryVideoBrandSwr, useQueryVideoScopeSwr } from "@/hooks/swr"
import { useVideoEditorStep } from "./useVideoEditorStep"
import type { VideoEditorAddress } from "./useVideoEditorStep"
import { useVideoReferences } from "./useVideoReferences"
import { brandOf, goalTemplateOf } from "./video.shared"
import type { Brand } from "./video.shared"

/** The video wizard: the project being edited, the step it is on, and what the steps offer around it. */
export const useVideoEditor = (address: VideoEditorAddress) => {
    const scope = useQueryVideoScopeSwr()
    const brandQuery = useQueryVideoBrandSwr()
    const references = useVideoReferences()
    const { project, step, failed: projectFailed, isLoaded } = useVideoEditorStep(address)
    const brand = useMemo<Brand | null>(() => (brandQuery.data ? brandOf(brandQuery.data) : null), [brandQuery.data])
    const failed = Boolean(scope.error || brandQuery.error) || projectFailed
    const isReady =
        !failed && scope.data !== undefined && brandQuery.data !== undefined && !references.isLoading && isLoaded
    const first = goalTemplateOf(project?.goal ?? "service")
    return {
        failed,
        isReady,
        canEdit: scope.data?.canEdit ?? false,
        project,
        step,
        wizardKey: project?.id ?? "new",
        media: references.media,
        sources: references.sources,
        brand,
        goal: {
            projectId: project?.id ?? null,
            goal: project?.goal ?? first.goal,
            aspect: project?.aspect ?? first.default_aspect,
            seconds: project?.targetSeconds ?? first.default_seconds,
            title: project?.title ?? "",
            locked: project?.status === "scripting" || project?.status === "rendering",
        },
    }
}

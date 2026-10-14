"use client"

import { useMemo } from "react"
import { useQueryVideoBrandSwr, useQueryVideoProjectsSwr, useQueryVideoScopeSwr } from "@/hooks/swr"
import { useVideoReferences } from "./useVideoReferences"
import { brandOf, projectViewOf } from "./video.shared"
import type { Brand } from "./video.shared"

/** What the library and the brand kit of the video workbench show, and whether they could be read. */
export const useVideoLibrary = () => {
    const scope = useQueryVideoScopeSwr()
    const projectsQuery = useQueryVideoProjectsSwr()
    const brandQuery = useQueryVideoBrandSwr()
    const references = useVideoReferences()
    const projects = useMemo(() => (projectsQuery.data ?? []).map(projectViewOf), [projectsQuery.data])
    const brand = useMemo<Brand | null>(() => (brandQuery.data ? brandOf(brandQuery.data) : null), [brandQuery.data])
    const failed = Boolean(scope.error || projectsQuery.error || brandQuery.error)
    const isReady = scope.data !== undefined && projectsQuery.data !== undefined && brandQuery.data !== undefined
    return {
        failed,
        isReady,
        isLoading: !failed && !(isReady && !references.isLoading),
        canEdit: scope.data?.canEdit ?? false,
        projects,
        brand,
        media: references.media,
        figures: references.figures,
        figuresFailed: failed || references.figuresFailed,
    }
}

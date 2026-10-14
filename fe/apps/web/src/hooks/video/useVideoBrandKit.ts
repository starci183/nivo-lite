"use client"

import { useMemo } from "react"
import { useQueryVideoBrandSwr, useQueryVideoMediaSwr, useQueryVideoScopeSwr } from "@/hooks/swr"
import { brandOf, mediaItemOf } from "./video.shared"
import type { Brand } from "./video.shared"

/** The brand kit of the workspace, its media library, and whether the member may change them. */
export const useVideoBrandKit = () => {
    const scope = useQueryVideoScopeSwr()
    const brandQuery = useQueryVideoBrandSwr()
    const mediaQuery = useQueryVideoMediaSwr()
    const brand = useMemo<Brand | null>(() => (brandQuery.data ? brandOf(brandQuery.data) : null), [brandQuery.data])
    const media = useMemo(() => (mediaQuery.data ?? []).map(mediaItemOf), [mediaQuery.data])
    return {
        brand,
        media,
        canEdit: scope.data?.canEdit ?? false,
        isReady: scope.data !== undefined && brandQuery.data !== undefined && mediaQuery.data !== undefined,
    }
}

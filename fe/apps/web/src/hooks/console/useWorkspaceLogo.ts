"use client"

import { useQueryVideoBrandSwr, useQueryVideoMediaSwr } from "@/hooks/swr"

/**
 * The workspace logo for the top bar: the logo of the brand kit (`video_brand_kits.logo_path`) as the signed URL the media library
 * answers, or null while loading, without a logo or when the brand kit cannot be read.
 */
export const useWorkspaceLogo = (): string | null => {
    const brand = useQueryVideoBrandSwr()
    const media = useQueryVideoMediaSwr()
    const path = brand.data?.logoPath ?? null
    if (path === null) return null
    return media.data?.find((item) => item.path === path)?.url ?? null
}

"use client"
import { slotOfReads } from "@/hooks/slot"
import { useQueryVideoBrandSwr, useQueryVideoMediaSwr, useQueryVideoScopeSwr } from "@/hooks/swr"
import { brandOf, mediaItemOf } from "./video.shared"

/** Owns the actual scope/brand/media reads shared by the library and editor; disabled keys stay idle. */
export const useVideoBrandKit = (isActive = true) => {
    const scope = useQueryVideoScopeSwr(isActive),
        brand = useQueryVideoBrandSwr(isActive),
        media = useQueryVideoMediaSwr(isActive)
    const reads = [scope, brand, media]
    const slot = slotOfReads(reads, () => {
        if (scope.data === undefined || brand.data === undefined || media.data === undefined)
            throw new Error("A ready brand kit requires all three settled reads")
        return { brand: brandOf(brand.data), media: media.data.map(mediaItemOf), canEdit: scope.data.canEdit }
    })
    return {
        slot,
        reads,
        data: "items" in slot ? slot.items : undefined,
        reload: () => Promise.all([scope.mutate(), brand.mutate(), media.mutate()]),
    }
}

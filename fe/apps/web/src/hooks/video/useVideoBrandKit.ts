"use client"
import { slotOfReads } from "@/hooks/slot"
import { useQueryVideoBrandSwr, useQueryVideoMediaSwr, useQueryVideoScopeSwr } from "@/hooks/swr"
import { brandOf, mediaItemOf, type Brand, type MediaItem } from "./video.shared"

import type { DataSlot } from "@/modules/types"
import type { SWRResponse } from "swr"

type UseVideoBrandKitResult = {
    slot: DataSlot<{
        brand: Brand
        media: MediaItem[]
        canEdit: boolean
    }>
    reads: (
        | SWRResponse<
              {
                  logoPath: string | null
                  musicTrack: string | null
                  primary: string
                  secondary: string
                  shopName: string
                  voice: string
              },
              unknown
          >
        | SWRResponse<
              {
                  kind: string
                  name: string
                  path: string
                  url: string | null
              }[],
              unknown
          >
        | SWRResponse<
              {
                  canEdit: boolean
                  workspaceId: string
              },
              unknown
          >
    )[]
    data:
        | {
              brand: Brand
              media: MediaItem[]
              canEdit: boolean
          }
        | undefined
    reload: () => Promise<
        [
            (
                | {
                      canEdit: boolean
                      workspaceId: string
                  }
                | undefined
            ),
            (
                | {
                      logoPath: string | null
                      musicTrack: string | null
                      primary: string
                      secondary: string
                      shopName: string
                      voice: string
                  }
                | undefined
            ),
            (
                | {
                      kind: string
                      name: string
                      path: string
                      url: string | null
                  }[]
                | undefined
            ),
        ]
    >
}

/** Owns the actual scope/brand/media reads shared by the library and editor; disabled keys stay idle. */
export const useVideoBrandKit = (isActive = true): UseVideoBrandKitResult => {
    const scope = useQueryVideoScopeSwr(isActive),
        brand = useQueryVideoBrandSwr(isActive),
        media = useQueryVideoMediaSwr(isActive)
    const reads = [scope, brand, media]
    const slot = slotOfReads(reads, () => {
        if (scope.data === undefined || brand.data === undefined || media.data === undefined)
            throw new Error("A ready brand kit requires all three settled reads")
        return {
            brand: brandOf(brand.data),
            media: media.data.map((item) => mediaItemOf(item)),
            canEdit: scope.data.canEdit,
        }
    })
    return {
        slot,
        reads,
        data: "items" in slot ? slot.items : undefined,
        reload: (): Promise<
            [
                (
                    | {
                          canEdit: boolean
                          workspaceId: string
                      }
                    | undefined
                ),
                (
                    | {
                          logoPath: string | null
                          musicTrack: string | null
                          primary: string
                          secondary: string
                          shopName: string
                          voice: string
                      }
                    | undefined
                ),
                (
                    | {
                          kind: string
                          name: string
                          path: string
                          url: string | null
                      }[]
                    | undefined
                ),
            ]
        > => Promise.all([scope.mutate(), brand.mutate(), media.mutate()]),
    }
}

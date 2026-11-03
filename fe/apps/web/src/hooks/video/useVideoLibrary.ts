"use client"
import { mapSlot, slotOfReads, slotOfSwr } from "@/hooks/slot"
import { useQueryVideoProjectsSwr } from "@/hooks/swr"
import { useVideoBrandKit } from "./useVideoBrandKit"
import { useVideoReferences } from "./useVideoReferences"
import { projectViewOf } from "./video.shared"

import type { ProjectView, MediaItem, Brand } from "./video.shared"
import type { DataSlot, WorkbenchFigureData } from "@/modules/types"

type UseVideoLibraryResult = {
    slot: DataSlot<{
        projects: ProjectView[]
        brand: Brand
        media: MediaItem[]
        canEdit: boolean
    }>
    data:
        | {
              projects: ProjectView[]
              brand: Brand
              media: MediaItem[]
              canEdit: boolean
          }
        | undefined
    figures: readonly WorkbenchFigureData[]
    figuresSlot: DataSlot<readonly WorkbenchFigureData[]>
    retryFigures: () => Promise<
        | {
              approved: number
              credits30: number
              published30: number
              readyToPublish: number
              rendering: number
              scripting: number
          }
        | undefined
    >
    reload: () => Promise<
        [
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
            ],
            (
                | {
                      approvedAt: string | null
                      approvedByName: string | null
                      aspect: string
                      createdAt: string
                      goal: string
                      id: string
                      lastErrorCode: string | null
                      publishedAt: string | null
                      renderCount: number
                      scriptMs: number | null
                      status: string
                      targetSeconds: number
                      title: string
                      updatedAt: string
                      version: number
                      inputs: {
                          auto: boolean
                          media: Array<string>
                          notes: string
                          sourceIds: Array<string>
                      }
                      render: {
                          captionsUrl: string | null
                          captionsLang: string | null
                          downloadUrl: string | null
                          durationMs: number | null
                          errorCode: string | null
                          id: string
                          posterUrl: string | null
                          progress: number
                          sizeBytes: number | null
                          stage: string | null
                          status: string
                          videoUrl: string | null
                      } | null
                      script: Array<{
                          caption: string
                          id: string
                          media: string | null
                          role: string
                          visual: string
                          voiceover: string
                      }>
                  }[]
                | undefined
            ),
        ]
    >
}

/** The normal library joins real kit/projects; its figures keep their own independent failure and retry. */
export const useVideoLibrary = (isActive = true): UseVideoLibraryResult => {
    const kit = useVideoBrandKit(isActive),
        projects = useQueryVideoProjectsSwr(false, isActive),
        references = useVideoReferences(isActive, false, true)
    const slot = slotOfReads([...kit.reads, projects], () => {
        if (kit.data === undefined || projects.data === undefined)
            throw new Error("A ready video library requires its actual kit and projects")
        return { ...kit.data, projects: projects.data.map(projectViewOf) }
    })
    return {
        slot,
        data: "items" in slot ? slot.items : undefined,
        figures: references.figures,
        figuresSlot: mapSlot(slotOfSwr(references.reads.figures), () => references.figures),
        retryFigures: (): Promise<
            | {
                  approved: number
                  credits30: number
                  published30: number
                  readyToPublish: number
                  rendering: number
                  scripting: number
              }
            | undefined
        > => references.reads.figures.mutate(),
        reload: (): Promise<
            [
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
                ],
                (
                    | {
                          approvedAt: string | null
                          approvedByName: string | null
                          aspect: string
                          createdAt: string
                          goal: string
                          id: string
                          lastErrorCode: string | null
                          publishedAt: string | null
                          renderCount: number
                          scriptMs: number | null
                          status: string
                          targetSeconds: number
                          title: string
                          updatedAt: string
                          version: number
                          inputs: {
                              auto: boolean
                              media: Array<string>
                              notes: string
                              sourceIds: Array<string>
                          }
                          render: {
                              captionsUrl: string | null
                              captionsLang: string | null
                              downloadUrl: string | null
                              durationMs: number | null
                              errorCode: string | null
                              id: string
                              posterUrl: string | null
                              progress: number
                              sizeBytes: number | null
                              stage: string | null
                              status: string
                              videoUrl: string | null
                          } | null
                          script: Array<{
                              caption: string
                              id: string
                              media: string | null
                              role: string
                              visual: string
                              voiceover: string
                          }>
                      }[]
                    | undefined
                ),
            ]
        > => Promise.all([kit.reload(), projects.mutate()]),
    }
}

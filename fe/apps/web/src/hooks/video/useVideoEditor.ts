"use client"
import { slotOfReads } from "@/hooks/slot"
import { useVideoBrandKit } from "./useVideoBrandKit"
import { useVideoEditorStep } from "./useVideoEditorStep"
import type { VideoEditorAddress } from "./useVideoEditorStep"
import { useVideoReferences } from "./useVideoReferences"
import { goalTemplateOf } from "./video.shared"

import type { Goal, Brand, SourceChoice, ProjectView, MediaItem } from "./video.shared"
import type { DataSlot } from "@/modules/types"
import type { SWRResponse } from "swr"

type UseVideoEditorResult = {
    slot: DataSlot<{
        canEdit: boolean
        project: ProjectView | null
        step: "goal" | "inputs" | "script" | "preview" | "result"
        wizardKey: string
        media: MediaItem[]
        sources: readonly SourceChoice[]
        brand: Brand
        goal: {
            projectId: string | null
            goal: Goal
            aspect: "9:16" | "1:1" | "16:9"
            seconds: number
            title: string
            locked: boolean
        }
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
        | SWRResponse<
              {
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
              },
              unknown,
              {
                  refreshInterval: (
                      project:
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
                            }
                          | undefined,
                  ) => 0 | 2000
              }
          >
        | SWRResponse<
              {
                  excerpt: string
                  id: string
                  title: string
                  topic: string | null
              }[],
              unknown
          >
    )[]
    step: "goal" | "inputs" | "script" | "preview" | "result"
    data:
        | {
              canEdit: boolean
              project: ProjectView | null
              step: "goal" | "inputs" | "script" | "preview" | "result"
              wizardKey: string
              media: MediaItem[]
              sources: readonly SourceChoice[]
              brand: Brand
              goal: {
                  projectId: string | null
                  goal: Goal
                  aspect: "9:16" | "1:1" | "16:9"
                  seconds: number
                  title: string
                  locked: boolean
              }
          }
        | undefined
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
                      excerpt: string
                      id: string
                      title: string
                      topic: string | null
                  }[]
                | undefined
            ),
            ...(
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
                  }
                | undefined
            )[],
        ]
    >
}

/** The editor joins only its actual kit, sources and enabled project read; a new project remains genuinely null. */
export const useVideoEditor = (address: VideoEditorAddress, isActive = true): UseVideoEditorResult => {
    const kit = useVideoBrandKit(isActive),
        references = useVideoReferences(isActive, true, false),
        selection = useVideoEditorStep(address, isActive)
    const reads = [...kit.reads, references.reads.sources, ...(selection.isEnabled ? [selection.read] : [])]
    const slot = slotOfReads(reads, () => {
        if (kit.data === undefined || references.reads.sources.data === undefined)
            throw new Error("A ready video editor requires its actual kit and sources")
        const project = selection.project,
            first = goalTemplateOf(project?.goal ?? "service")
        return {
            canEdit: kit.data.canEdit,
            project,
            step: selection.step,
            wizardKey: project?.id ?? "new",
            media: kit.data.media,
            sources: references.sources,
            brand: kit.data.brand,
            goal: {
                projectId: project?.id ?? null,
                goal: project?.goal ?? first.goal,
                aspect: project?.aspect ?? first.default_aspect,
                seconds: project?.targetSeconds ?? first.default_seconds,
                title: project?.title ?? "",
                locked: project?.status === "scripting" || project?.status === "rendering",
            },
        }
    })
    return {
        slot,
        reads,
        step: selection.step,
        data: "items" in slot ? slot.items : undefined,
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
                          excerpt: string
                          id: string
                          title: string
                          topic: string | null
                      }[]
                    | undefined
                ),
                ...(
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
                      }
                    | undefined
                )[],
            ]
        > =>
            Promise.all([
                kit.reload(),
                references.reads.sources.mutate(),
                ...(selection.isEnabled ? [selection.read.mutate()] : []),
            ]),
    }
}

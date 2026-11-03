"use client"

import { useTranslations } from "next-intl"
import {
    useMutateArchiveVideoProjectSwr,
    useMutateCreateVideoProjectSwr,
    useMutateDuplicateVideoProjectSwr,
    useMutateUpdateVideoProjectSwr,
} from "@/hooks/swr"
import type { MutateCreateVideoProjectRequest, MutateUpdateVideoProjectRequest } from "@/hooks/swr"
import type { ProjectInputs, ScriptScene } from "@/modules/video"
import { projectCommandOf } from "./video.shared"
import { useVideoRefresh } from "./useVideoRefresh"
import type { VideoOwner } from "./useVideoRefresh"

import type { TriggerWithArgs } from "swr/mutation"

/** The edits one update sends: the inputs and the scenes arrive as the editor holds them, read-only. */
interface VideoProjectPatch extends Omit<MutateUpdateVideoProjectRequest, "projectId" | "inputs" | "script"> {
    readonly inputs?: ProjectInputs
    readonly script?: ReadonlyArray<ScriptScene>
}

type UseVideoActionsResult = {
    create: (
        request: MutateCreateVideoProjectRequest,
        onResult?: (
            result:
                | Awaited<
                      ReturnType<
                          TriggerWithArgs<
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
                              any,
                              "MUTATE_CREATE_VIDEO_PROJECT_SWR",
                              {
                                  inputs?:
                                      | ({} & {
                                            auto: boolean
                                            media: string[]
                                            notes: string
                                            sourceIds: (string | number)[]
                                        })
                                      | null
                                      | undefined
                                  title?: string | null | undefined
                              } & {
                                  aspect: string
                                  goal: string
                                  targetSeconds: number
                              }
                          >
                      >
                  >
                | undefined,
        ) => void,
    ) => Promise<
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
    >
    update: (
        projectId: string,
        patch: VideoProjectPatch,
        onResult?: (
            result:
                | Awaited<
                      ReturnType<
                          TriggerWithArgs<
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
                              any,
                              "MUTATE_UPDATE_VIDEO_PROJECT_SWR",
                              {
                                  aspect?: string | null | undefined
                                  goal?: string | null | undefined
                                  inputs?:
                                      | ({} & {
                                            auto: boolean
                                            media: string[]
                                            notes: string
                                            sourceIds: (string | number)[]
                                        })
                                      | null
                                      | undefined
                                  script?:
                                      | ({
                                            media?: string | null | undefined
                                        } & {
                                            caption: string
                                            id: string
                                            role: string
                                            visual: string
                                            voiceover: string
                                        })[]
                                      | null
                                      | undefined
                                  targetSeconds?: number | null | undefined
                                  title?: string | null | undefined
                              } & {
                                  projectId: string | number
                              }
                          >
                      >
                  >
                | undefined,
        ) => void,
    ) => Promise<
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
    >
    duplicate: (
        projectId: string,
        onResult?:
            | ((
                  result:
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
              ) => void)
            | undefined,
    ) => Promise<
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
    >
    archive: (
        projectId: string,
        onResult?:
            | ((
                  result:
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
              ) => void)
            | undefined,
    ) => Promise<
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
    >
    isPending: boolean
}

/** Creates, edits, duplicates and archives video projects, reports every outcome, and reads the video data again. */
export const useVideoActions = (owner?: VideoOwner): UseVideoActionsResult => {
    const t = useTranslations("video")
    const { complete, isPending } = useVideoRefresh(owner)
    const createMutation = useMutateCreateVideoProjectSwr()
    const updateMutation = useMutateUpdateVideoProjectSwr()
    const duplicateMutation = useMutateDuplicateVideoProjectSwr()
    const archiveMutation = useMutateArchiveVideoProjectSwr()
    const create = (
        request: MutateCreateVideoProjectRequest,
        onResult?: (
            result:
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
        ) => void,
    ): Promise<
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
    > => complete(() => createMutation.trigger(request), t("saved"), onResult)
    const update = (
        projectId: string,
        patch: VideoProjectPatch,
        onResult?: (
            result:
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
        ) => void,
    ): Promise<
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
    > => {
        const request: MutateUpdateVideoProjectRequest = {
            ...patch,
            projectId,
            inputs: patch.inputs
                ? { ...patch.inputs, sourceIds: [...patch.inputs.sourceIds], media: [...patch.inputs.media] }
                : undefined,
            script: patch.script?.map((scene) => ({ ...scene })),
        }
        return complete(() => updateMutation.trigger(request), t("saved"), onResult)
    }
    const duplicate = projectCommandOf(complete, (projectId) => duplicateMutation.trigger({ projectId }), t("saved"))
    const archive = projectCommandOf(
        complete,
        (projectId) => archiveMutation.trigger({ projectId, archived: true }),
        t("status_archived"),
    )
    return { create, update, duplicate, archive, isPending }
}

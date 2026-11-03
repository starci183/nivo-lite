"use client"

import { useTranslations } from "next-intl"
import {
    useMutateApproveVideoProjectSwr,
    useMutateMarkVideoPublishedSwr,
    useMutateSaveVideoBrandSwr,
    useMutateShareVideoProjectSwr,
} from "@/hooks/swr"
import type { Brand } from "@/modules/video"
import { projectCommandOf } from "./video.shared"
import { useVideoRefresh } from "./useVideoRefresh"
import type { VideoOwner } from "./useVideoRefresh"

import type { TriggerWithArgs } from "swr/mutation"

type UseVideoReleaseResult = {
    approve: (
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
    publish: (
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
    share: (
        projectId: string,
        onResult?:
            | ((
                  result:
                      | {
                            office: boolean
                            telegram: boolean
                        }
                      | undefined,
              ) => void)
            | undefined,
    ) => Promise<
        | {
              office: boolean
              telegram: boolean
          }
        | undefined
    >
    saveBrand: (
        brand: Brand,
        onResult?: (
            result:
                | Awaited<
                      ReturnType<
                          TriggerWithArgs<
                              {
                                  logoPath: string | null
                                  musicTrack: string | null
                                  primary: string
                                  secondary: string
                                  shopName: string
                                  voice: string
                              },
                              any,
                              "MUTATE_SAVE_VIDEO_BRAND_SWR",
                              {
                                  logoPath?: string | null | undefined
                                  musicTrack?: string | null | undefined
                              } & {
                                  primary: string
                                  secondary: string
                                  shopName: string
                                  voice: string
                              }
                          >
                      >
                  >
                | undefined,
        ) => void,
    ) => Promise<
        | {
              logoPath: string | null
              musicTrack: string | null
              primary: string
              secondary: string
              shopName: string
              voice: string
          }
        | undefined
    >
    isPending: boolean
}

/** Approves, publishes and shares a video and saves the brand kit, reports every outcome, and reads the video data again. */
export const useVideoRelease = (owner?: VideoOwner): UseVideoReleaseResult => {
    const t = useTranslations("video")
    const { complete, isPending } = useVideoRefresh(owner)
    const approveMutation = useMutateApproveVideoProjectSwr()
    const publishMutation = useMutateMarkVideoPublishedSwr()
    const shareMutation = useMutateShareVideoProjectSwr()
    const brandMutation = useMutateSaveVideoBrandSwr()
    const approve = projectCommandOf(
        complete,
        (projectId) => approveMutation.trigger({ projectId }),
        t("status_approved"),
    )
    const publish = projectCommandOf(complete, (projectId) => publishMutation.trigger({ projectId }), t("postedNote"))
    const share = projectCommandOf(complete, (projectId) => shareMutation.trigger({ projectId }), t("shared"))
    const saveBrand = (
        brand: Brand,
        onResult?: (
            result:
                | {
                      logoPath: string | null
                      musicTrack: string | null
                      primary: string
                      secondary: string
                      shopName: string
                      voice: string
                  }
                | undefined,
        ) => void,
    ): Promise<
        | {
              logoPath: string | null
              musicTrack: string | null
              primary: string
              secondary: string
              shopName: string
              voice: string
          }
        | undefined
    > => complete(() => brandMutation.trigger(brand), t("brandSaved"), onResult)
    return { approve, publish, share, saveBrand, isPending }
}

import type { VideoProductionViews } from "@/modules/types"
/** One publication fact chip of a rendered video: its id, tone and text. */
export type VideoResultBadge = VideoProductionViews["resultBadge"]

import type { VideoEditorData, Brand, MediaItem, ProjectView, VideoWorkbenchCopy } from "@/modules/video"
import type { useTranslations, useFormatter } from "next-intl"
/** Real tenant/instance and selected surface, not synthetic query state. */
export interface VideoViewInput {
    readonly editor: VideoEditorData | null
    readonly library: {
        readonly brand: Brand
        readonly media: ReadonlyArray<MediaItem>
        readonly projects: ReadonlyArray<ProjectView>
        readonly canEdit: boolean
    } | null
    readonly copy: VideoWorkbenchCopy
    readonly isActive: boolean
    readonly scope: string
}
/** The picture shape an aspect ratio is drawn in: portrait, square or landscape. */
export const shapeOf = (aspect: string): "portrait" | "square" | "landscape" => {
    if (aspect === "9:16") return "portrait"
    return aspect === "1:1" ? "square" : "landscape"
}
type VideoOwnerOfResult = {
    isActive: boolean
    scope: string
}

/** Commands and reads share the actual tenant/instance scope plus their existing region identity. */
export const videoOwnerOf = (input: VideoViewInput, region: string): VideoOwnerOfResult => ({
    isActive: input.isActive,
    scope: JSON.stringify([input.scope, region]),
})
/** Reorders only existing scene positions, retaining every identity. */
export const swapped = <T>(scenes: ReadonlyArray<T>, index: number, target: number): ReadonlyArray<T> => {
    const from = scenes[index],
        to = scenes[target]
    if (from === undefined || to === undefined) return scenes
    return scenes.map((scene, at) => {
        if (at === index) return to
        return at === target ? from : scene
    })
}

/** Publication facts retain their actual length, size, aspect and approval provenance. */
export const videoResultBadgesOf = (
    project: ProjectView,
    t: ReturnType<typeof useTranslations<"video">>,
    format: ReturnType<typeof useFormatter>,
): ReadonlyArray<VideoResultBadge> => {
    const render = project.render
    const approved = project.status === "approved" || project.status === "published"
    return [
        ...(render?.durationMs
            ? [
                  {
                      id: "length",
                      tone: "neutral" as const,
                      text: t("seconds", { n: Math.round(render.durationMs / 1000) }),
                  },
              ]
            : []),
        ...(render?.sizeBytes
            ? [
                  {
                      id: "size",
                      tone: "neutral" as const,
                      text: t("fileSize", {
                          n: format.number(render.sizeBytes / 1_048_576, { maximumFractionDigits: 1 }),
                      }),
                  },
              ]
            : []),
        { id: "aspect", tone: "neutral" as const, text: project.aspect },
        ...(approved
            ? [
                  {
                      id: "approved",
                      tone: "success" as const,
                      text:
                          project.approvedByName === null
                              ? t(`status_${project.status}`)
                              : t("approvedBy", { name: project.approvedByName }),
                  },
              ]
            : []),
    ]
}

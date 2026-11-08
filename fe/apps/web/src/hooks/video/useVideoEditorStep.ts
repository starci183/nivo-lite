"use client"
import { useMemo } from "react"
import { useQueryVideoProjectSwr } from "@/hooks/swr"
import { isUuid, projectViewOf, stepFor, type EditorStep, type ProjectView } from "./video.shared"

import type { SWRResponse } from "swr"
const STEPS: ReadonlyArray<EditorStep> = ["goal", "inputs", "script", "preview", "result"]
/** Actual address choices of the editor. */
export interface VideoEditorAddress {
    readonly tab: string | null
    readonly focus: string | null
}
type UseVideoEditorStepResult = {
    project: ProjectView | null
    step: "goal" | "inputs" | "script" | "preview" | "result"
    read: SWRResponse<
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
    isEnabled: boolean
}

/** One actual optional project query, with the same requested-or-derived wizard step. */
export const useVideoEditorStep = (address: VideoEditorAddress, isActive = true): UseVideoEditorStepResult => {
    const projectId = isActive && address.focus !== null && isUuid(address.focus) ? address.focus : undefined
    const read = useQueryVideoProjectSwr(projectId)
    const project = useMemo(() => (read.data ? projectViewOf(read.data) : null), [read.data])
    const step: EditorStep = project
        ? (STEPS.find((entry) => entry === address.tab) ?? stepFor(project.status, project.script.length))
        : "goal"
    return { project, step, read, isEnabled: projectId !== undefined }
}

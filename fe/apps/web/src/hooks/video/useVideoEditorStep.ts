"use client"
import { useMemo } from "react"
import { useQueryVideoProjectSwr } from "@/hooks/swr"
import { isUuid, projectViewOf, stepFor } from "./video.shared"
import type { EditorStep } from "./video.shared"
const STEPS: ReadonlyArray<EditorStep> = ["goal", "inputs", "script", "preview", "result"]
/** Actual address choices of the editor. */
export interface VideoEditorAddress {
    readonly tab: string | null
    readonly focus: string | null
}
/** One actual optional project query, with the same requested-or-derived wizard step. */
export const useVideoEditorStep = (address: VideoEditorAddress, isActive = true) => {
    const projectId = isActive && address.focus !== null && isUuid(address.focus) ? address.focus : undefined
    const read = useQueryVideoProjectSwr(projectId)
    const project = useMemo(() => (read.data ? projectViewOf(read.data) : null), [read.data])
    const step: EditorStep = project
        ? (STEPS.find((entry) => entry === address.tab) ?? stepFor(project.status, project.script.length))
        : "goal"
    return { project, step, read, isEnabled: projectId !== undefined }
}

"use client"

import { useMemo } from "react"
import { useQueryVideoProjectSwr } from "@/hooks/swr"
import { isUuid, projectViewOf, stepFor } from "./video.shared"
import type { EditorStep } from "./video.shared"

const STEPS: ReadonlyArray<EditorStep> = ["goal", "inputs", "script", "preview", "result"]

/** The address choices of the wizard. */
export interface VideoEditorAddress {
    /** The current wizard step named in the address. */
    readonly tab: string | null
    /** The project id or the new-project command. */
    readonly focus: string | null
}

/** The project the address names and the step it is on: the step in the address, or the one its progress calls for. */
export const useVideoEditorStep = (address: VideoEditorAddress) => {
    const projectId = address.focus !== null && isUuid(address.focus) ? address.focus : undefined
    const projectQuery = useQueryVideoProjectSwr(projectId)
    const project = useMemo(() => (projectQuery.data ? projectViewOf(projectQuery.data) : null), [projectQuery.data])
    const step: EditorStep = project
        ? (STEPS.find((entry) => entry === address.tab) ?? stepFor(project.status, project.script.length))
        : "goal"
    const failed = Boolean(projectQuery.error)
    const isLoaded = projectId === undefined || projectQuery.data !== undefined
    return { project, step, failed, isLoaded }
}

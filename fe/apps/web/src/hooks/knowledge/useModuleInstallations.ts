"use client"

import { useMemo } from "react"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr"
import { toWireInstallation } from "@/modules/documents"
import { readError } from "@/hooks/workspaceread"
import type { Installation } from "@/modules/installations"

/** The view `useModuleInstallations` returns. */
export interface ModuleInstallationsView {
    installations: Installation[] | undefined
    error: unknown
    isLoading: boolean
}

/** The installed agents (instances) of the active workspace, in the shape the blocks know. */
export const useModuleInstallations = (): ModuleInstallationsView => {
    const swrRead = useQueryModuleInstallationsSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const installations = useMemo(
        () =>
            data === undefined
                ? undefined
                : data.flatMap((row) => {
                      const installation = toWireInstallation(row)
                      return installation === null ? [] : [installation]
                  }),
        [data],
    )
    return { installations, error, isLoading }
}

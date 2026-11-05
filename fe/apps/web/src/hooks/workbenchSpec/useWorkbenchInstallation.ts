"use client"

import { isModuleKey } from "@/modules/catalog"
import { instancesOf } from "@/modules/installations"
import { useInstallations } from "@/hooks/installations"

/** The installation a workbench opens for: the first installation of the module in the active workspace; null while the installations load or when the module is not installed. */
export const useWorkbenchInstallation = (module: string): string | null => {
    const { installations } = useInstallations()
    if (installations === undefined || !isModuleKey(module)) return null
    return instancesOf(installations, module)[0]?.id ?? null
}

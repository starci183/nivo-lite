"use client"

import { useContext } from "react"
import { isModuleKey } from "@/modules/catalog"
import { instancesOf } from "@/modules/installations"
import { useInstallations } from "@/hooks/installations"
import { FixtureInstallationContext } from "@/modules/workbench-host"

/**
 * The installation a workbench opens for: the one the fixtures answer for when the prototype layout provided it, else the first
 * installation of the module in the active workspace. Null while the installations load or when the module is not installed.
 */
export const useWorkbenchInstallation = (module: string): string | null => {
    const fixture = useContext(FixtureInstallationContext)
    const { installations } = useInstallations()
    if (!isModuleKey(module)) return null
    if (fixture !== null) return fixture
    if (installations === undefined) return null
    return instancesOf(installations, module)[0]?.id ?? null
}

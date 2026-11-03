"use client"

import { useEffect } from "react"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import type { Installation } from "@/modules/installations"
import { useInstallations } from "./useInstallations"

/** The one instance an agent url names. */
interface InstanceGuard {
    readonly installation: Installation | undefined
    /** The resolved instance URL belongs elsewhere; the owning slot waits for navigation. */
    readonly isLeaving: boolean
}

/**
 * Checks the instance of an agent url against the installed agents: an unknown instance goes back to the type, an instance of
 * another type goes to its own url. Until then the guard reads as loading.
 */
export const useInstanceGuard = (module: ModuleKey, installationId: string): InstanceGuard => {
    const router = navigation.useRouter()
    const { installations } = useInstallations()
    const installation = installations?.find((entry) => entry.id === installationId)
    const target = (() => {
        if (installations === undefined) return null
        if (installation === undefined) return agentHref(module, null)
        return installation.moduleKey === module ? null : agentHref(installation.moduleKey, installation.id)
    })()
    useEffect(() => {
        if (target !== null) router.replace(target)
    }, [target, router])
    return {
        installation: target === null ? installation : undefined,
        isLeaving: target !== null,
    }
}

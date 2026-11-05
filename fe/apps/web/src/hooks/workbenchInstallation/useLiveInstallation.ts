"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { BUILT_REGISTRY_HASH, servedInstallation } from "@/modules/workbench-installation"
import type { WorkbenchInstallation } from "@/modules/workbench-installation"

/** Loads the newest bundle. */
const reloadPage = (): void => window.location.reload()

/**
 * The installation of the live host: the modules the back end enables and the comparison of its registry hash with the one this
 * bundle was generated with; a mismatch shows the workbench "a new version is out, reload" in the viewer language.
 */
export const useLiveInstallation = (): WorkbenchInstallation => {
    const t = useTranslations("workbenchHost")
    const served = servedInstallation()
    const stale = t("stale")
    const reload = t("reload")
    return useMemo<WorkbenchInstallation>(
        () => ({
            enabled: served.enabled,
            registry: {
                built: BUILT_REGISTRY_HASH,
                served: served.registryHash,
                message: stale,
                reloadLabel: reload,
                reload: reloadPage,
            },
        }),
        [served.enabled, served.registryHash, stale, reload],
    )
}

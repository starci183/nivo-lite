"use client"

import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryModulesCatalogSwr } from "@/hooks/swr"
import { isModuleKey } from "@/modules/catalog"
import type { ModuleCopy, ModuleKey } from "@/modules/catalog"

/** Backend-owned copy keyed by known frontend module identifiers, with its read state. */
export const useModuleCatalog = () => {
    const read = useQueryModulesCatalogSwr()
    const copies = useMemo(
        () =>
            read.data?.modules.flatMap((entry): Array<ModuleCopy> =>
                isModuleKey(entry.key) ? [{ ...entry, key: entry.key }] : [],
            ),
        [read.data],
    )
    const modules = useMemo(
        (): Partial<Record<ModuleKey, ModuleCopy>> =>
            Object.fromEntries((copies ?? []).map((entry) => [entry.key, entry])),
        [copies],
    )
    return {
        modules,
        categories: read.data?.categories ?? [],
        error: read.error,
        slot: slotOfSwr({ data: copies, error: read.error, isLoading: read.isLoading }),
        reload: () => void read.mutate(),
    }
}

"use client"

import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryModulesCatalogSwr } from "@/hooks/swr"
import { isModuleKey } from "@/modules/catalog"
import type { ModuleCopy, ModuleKey } from "@/modules/catalog"
import { readError } from "@/hooks/workspaceread"

import type { DataSlot } from "@/modules/types"
import type { SWRResponse } from "swr"

type UseModuleCatalogResult = {
    read: SWRResponse<
        {
            categories: Array<{
                key: string
                label: {
                    vi: string
                    en: string
                }
            }>
            modules: Array<{
                key: string
                name: {
                    vi: string
                    en: string
                }
                shortName: {
                    vi: string
                    en: string
                }
                description: {
                    vi: string
                    en: string
                }
                points: {
                    vi: Array<string>
                    en: Array<string>
                }
                gates: Array<{
                    key: string
                    label_vi: string
                    label_en: string
                    hint_vi: string
                    hint_en: string
                    writes: Array<{
                        kind: string
                        subjectType: string | null
                        attributeLabel: string | null
                        scope: string | null
                        action: string | null
                        field: string | null
                    }> | null
                }>
                authorityActions: Array<{
                    action: string
                    note: string
                    label: {
                        vi: string
                        en: string
                    }
                }>
            }>
        },
        unknown
    >
    modules: Partial<
        Record<
            | "chatbot"
            | "lead_gen"
            | "sales"
            | "accounting"
            | "shifts"
            | "booking"
            | "inventory"
            | "loyalty"
            | "video"
            | "content"
            | "hiring",
            ModuleCopy
        >
    >
    categories: {
        key: string
        label: {
            vi: string
            en: string
        }
    }[]
    error: unknown
    slot: DataSlot<ModuleCopy[]>
    reload: () => undefined
}

/** Backend-owned copy keyed by known frontend module identifiers, with its read state. */
export const useModuleCatalog = (): UseModuleCatalogResult => {
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
            copies === undefined ? {} : Object.fromEntries(copies.map((entry) => [entry.key, entry])),
        [copies],
    )
    return {
        read,
        modules,
        categories: read.data?.categories ?? [],
        error: readError(read),
        slot: slotOfSwr({ data: copies, error: read.error, isLoading: read.isLoading }),
        reload: (): undefined => void read.mutate(),
    }
}

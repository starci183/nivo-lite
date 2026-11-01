"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useQueryBrainDossiersSwr, useQueryKnowledgeCategoriesSwr, useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { categoriesOf, folderKeyOf } from "@/modules/brain"

/**
 * The categories of the documents of the active workspace with the dossiers filed under each, and how much of the raw document
 * allowance is used. The categories come from the grouped back end read, so the totals never depend on how many documents the page loads.
 */
export const useBrainDossiers = () => {
    const t = useTranslations("secondBrain")
    const categoriesRead = useQueryKnowledgeCategoriesSwr()
    const dossiersRead = useQueryBrainDossiersSwr()
    const { data: usage } = useQueryKnowledgeUsageSwr()
    const totals = categoriesRead.data
    const dossiers = dossiersRead.data
    const categories = useMemo(() => {
        if (totals === undefined || dossiers === undefined) return undefined
        return categoriesOf(totals, dossiers, (topic) => {
            const key = folderKeyOf(topic)
            return key === null ? undefined : t(`folder_${key}`)
        })
    }, [totals, dossiers, t])
    const slot = slotOfSwr({
        data: categories,
        error: categoriesRead.error ?? dossiersRead.error,
        isLoading: categoriesRead.isLoading || dossiersRead.isLoading,
    })
    const reload = () => {
        void categoriesRead.mutate()
        void dossiersRead.mutate()
    }
    return { categories, slot, reload, usage }
}

"use client"

import { useMemo } from "react"
import { useQueryBrainDossiersSwr, useQueryKnowledgeCategoriesSwr, useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { categoriesOf } from "@/modules/brain"

/**
 * The categories of the documents of the active workspace with the dossiers filed under each, and how much of the raw document
 * allowance is used. The categories come from the grouped back end read, so the totals never depend on how many documents the page loads.
 */
export const useBrainDossiers = () => {
    const categoriesRead = useQueryKnowledgeCategoriesSwr()
    const dossiersRead = useQueryBrainDossiersSwr()
    const { data: usage } = useQueryKnowledgeUsageSwr()
    const totals = categoriesRead.data
    const dossiers = dossiersRead.data
    const categories = useMemo(
        () => (totals === undefined || dossiers === undefined ? undefined : categoriesOf(totals, dossiers)),
        [totals, dossiers],
    )
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

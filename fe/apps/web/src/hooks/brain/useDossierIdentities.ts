"use client"

import { useQueryBrainDossiersSwr } from "@/hooks/swr"

/** The dossier of the checklist a pane is about: what names it and what files a document under it. */
export interface DossierIdentity {
    readonly id: string
    readonly ref: string
    readonly name: string
    readonly category: string
    /** The status the checklist imported, before the review looked at it. */
    readonly status: string
}

/** The dossiers the workspace tracks, to look one up by id; the lookup answers undefined until they are read. */
export const useDossierIdentities = () => {
    const read = useQueryBrainDossiersSwr()
    const identityOf = (dossierId: string | undefined): DossierIdentity | undefined => {
        const record = read.data?.find((one) => one.id === dossierId)
        return record === undefined
            ? undefined
            : {
                  id: record.id,
                  ref: record.ref,
                  name: record.name,
                  category: record.category,
                  status: record.status,
              }
    }
    return { identityOf, isLoading: read.isLoading }
}

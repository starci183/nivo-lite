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

/** What a dossier lookup gives a pane. */
interface DossierRecordRead {
    readonly dossier: DossierIdentity | undefined
    readonly isLoading: boolean
}

/** The dossier with the given id from the dossiers the workspace tracks; undefined while they load or when it is not among them. */
export const useDossierRecord = (dossierId: string | undefined): DossierRecordRead => {
    const read = useQueryBrainDossiersSwr()
    const record = read.data?.find((one) => one.id === dossierId)
    return {
        dossier:
            record === undefined
                ? undefined
                : {
                      id: record.id,
                      ref: record.ref,
                      name: record.name,
                      category: record.category,
                      status: record.status,
                  },
        isLoading: read.isLoading,
    }
}

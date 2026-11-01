"use client"

import { useDossierIdentities } from "./useDossierIdentities"
import type { DossierIdentity } from "./useDossierIdentities"

/** What a dossier lookup gives a pane. */
interface DossierRecordRead {
    readonly dossier: DossierIdentity | undefined
    readonly isLoading: boolean
}

/** The dossier with the given id from the dossiers the workspace tracks; undefined while they load or when it is not among them. */
export const useDossierRecord = (dossierId: string | undefined): DossierRecordRead => {
    const { identityOf, isLoading } = useDossierIdentities()
    return { dossier: identityOf(dossierId), isLoading }
}

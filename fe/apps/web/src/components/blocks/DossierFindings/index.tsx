"use client"

import { useDossierFindingsView } from "@/hooks/brain"
import { DossierFindingsBase } from "./component"

/** Direct dossier selection, or the map node the connected pane resolves against the actual map read. */
type DossierFindingsProps =
    | { readonly dossierId: string; readonly findingId: string | undefined }
    | { readonly selection: { readonly kind: "map"; readonly nodeId: string | undefined } }

/** The findings of one dossier; an unresolved or non-dossier map selection keeps this region absent. */
export const DossierFindings = (props: DossierFindingsProps) => {
    const input = "selection" in props ? props.selection : { kind: "dossier" as const, ...props }
    const view = useDossierFindingsView(input)
    return <DossierFindingsBase props={view.props} on={view.on} />
}

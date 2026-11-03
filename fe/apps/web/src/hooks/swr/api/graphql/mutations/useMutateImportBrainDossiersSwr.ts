"use client"

import useSWRMutation from "swr/mutation"
import { mutateImportBrainDossiers } from "@/modules/api/graphql/mutations/mutation-import-brain-dossiers"
import type { MutateImportBrainDossiersRequest } from "@/modules/api/graphql/mutations/mutation-import-brain-dossiers"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the ImportBrainDossiers mutation is triggered with. */
interface ImportBrainDossiersArg {
    readonly arg: MutateImportBrainDossiersRequest
}

/** The SWR key of the importBrainDossiers mutation. */
export const MUTATE_IMPORT_BRAIN_DOSSIERS_SWR_KEY = "MUTATE_IMPORT_BRAIN_DOSSIERS_SWR"

/** SWR mutation for {@link mutateImportBrainDossiers}: replaces the dossiers of the workspace with those of a checklist workbook. `trigger(input)` rejects with the back end failure. */
export const useMutateImportBrainDossiersSwr = (): SWRMutationResponse<
    OperationData<typeof mutateImportBrainDossiers>["importBrainDossiers"],
    Error,
    typeof MUTATE_IMPORT_BRAIN_DOSSIERS_SWR_KEY,
    ImportBrainDossiersArg["arg"]
> =>
    useSWRMutation(MUTATE_IMPORT_BRAIN_DOSSIERS_SWR_KEY, async (_key: string, { arg }: ImportBrainDossiersArg) => {
        const result = await mutateImportBrainDossiers({ request: arg })
        if (!result.data) throw new Error("importBrainDossiers answered no data")
        return result.data.importBrainDossiers
    })

"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateReopenDossierFinding,
    type MutateReopenDossierFindingRequest,
} from "@/modules/api/graphql/mutations/mutation-reopen-dossier-finding"
import type { SWRMutationResponse } from "swr/mutation"
import type { ReopenDossierFindingMutation } from "@/modules/api"

/** What the ReopenDossierFinding mutation is triggered with. */
interface ReopenDossierFindingArg {
    readonly arg: MutateReopenDossierFindingRequest
}

/** The SWR key of the reopenDossierFinding mutation. */
export const MUTATE_REOPEN_DOSSIER_FINDING_SWR_KEY = "MUTATE_REOPEN_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateReopenDossierFinding}: opens a dismissed or resolved finding again. `trigger(input)` rejects with the back end failure. */
export const useMutateReopenDossierFindingSwr = (): SWRMutationResponse<
    ReopenDossierFindingMutation["reopenDossierFinding"],
    Error,
    typeof MUTATE_REOPEN_DOSSIER_FINDING_SWR_KEY,
    ReopenDossierFindingArg["arg"]
> =>
    useSWRMutation(MUTATE_REOPEN_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: ReopenDossierFindingArg) => {
        const result = await mutateReopenDossierFinding({ request: arg })
        if (!result.data) throw new Error("reopenDossierFinding answered no data")
        return result.data.reopenDossierFinding
    })

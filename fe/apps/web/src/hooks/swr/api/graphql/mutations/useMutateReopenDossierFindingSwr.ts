"use client"

import useSWRMutation from "swr/mutation"
import { mutateReopenDossierFinding } from "@/modules/api/graphql/mutations/mutation-reopen-dossier-finding"
import type { MutateReopenDossierFindingRequest } from "@/modules/api/graphql/mutations/mutation-reopen-dossier-finding"

/** What the ReopenDossierFinding mutation is triggered with. */
interface ReopenDossierFindingArg {
    readonly arg: MutateReopenDossierFindingRequest
}

/** The SWR key of the reopenDossierFinding mutation. */
export const MUTATE_REOPEN_DOSSIER_FINDING_SWR_KEY = "MUTATE_REOPEN_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateReopenDossierFinding}: opens a dismissed or resolved finding again. `trigger(input)` rejects with the back end failure. */
export const useMutateReopenDossierFindingSwr = () =>
    useSWRMutation(MUTATE_REOPEN_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: ReopenDossierFindingArg) => {
        const result = await mutateReopenDossierFinding({ request: arg })
        if (!result.data) throw new Error("reopenDossierFinding answered no data")
        return result.data.reopenDossierFinding
    })

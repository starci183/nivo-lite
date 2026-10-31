"use client"

import useSWRMutation from "swr/mutation"
import { mutateResolveDossierFinding } from "@/modules/api/graphql/mutations/mutation-resolve-dossier-finding"
import type { MutateResolveDossierFindingRequest } from "@/modules/api/graphql/mutations/mutation-resolve-dossier-finding"

/** What the ResolveDossierFinding mutation is triggered with. */
interface ResolveDossierFindingArg {
    readonly arg: MutateResolveDossierFindingRequest
}

/** The SWR key of the resolveDossierFinding mutation. */
export const MUTATE_RESOLVE_DOSSIER_FINDING_SWR_KEY = "MUTATE_RESOLVE_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateResolveDossierFinding}: marks a finding done by hand, with the note of what was done outside. `trigger(input)` rejects with the back end failure. */
export const useMutateResolveDossierFindingSwr = () =>
    useSWRMutation(MUTATE_RESOLVE_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: ResolveDossierFindingArg) => {
        const result = await mutateResolveDossierFinding({ request: arg })
        if (!result.data) throw new Error("resolveDossierFinding answered no data")
        return result.data.resolveDossierFinding
    })

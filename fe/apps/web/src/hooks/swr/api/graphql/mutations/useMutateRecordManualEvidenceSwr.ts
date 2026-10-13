import useSWRMutation from "swr/mutation"
import { mutateRecordManualEvidence } from "@/modules/api/graphql/mutations/mutation-record-manual-evidence"
import type { MutateRecordManualEvidenceRequest } from "@/modules/api/graphql/mutations/mutation-record-manual-evidence"

/** What the RecordManualEvidence mutation is triggered with. */
interface RecordManualEvidenceArg {
    readonly arg: MutateRecordManualEvidenceRequest
}

/** The SWR key of the recordManualEvidence mutation. */
export const MUTATE_RECORD_MANUAL_EVIDENCE_SWR_KEY = "MUTATE_RECORD_MANUAL_EVIDENCE_SWR"

/** SWR mutation for {@link mutateRecordManualEvidence}: Admits one piece of manual evidence; answers whether it was a duplicate. `trigger(input)` rejects with the back end failure. */
export const useMutateRecordManualEvidenceSwr = () =>
    useSWRMutation(MUTATE_RECORD_MANUAL_EVIDENCE_SWR_KEY, async (_key: string, { arg }: RecordManualEvidenceArg) => {
        const result = await mutateRecordManualEvidence({ request: arg })
        if (!result.data) throw new Error("recordManualEvidence answered no data")
        return result.data.recordManualEvidence
    })

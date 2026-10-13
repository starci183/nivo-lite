import { useCallback } from "react"
import { useMutateRecordManualEvidenceSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRecordManualEvidenceSwr"
import type { MutateRecordManualEvidenceRequest } from "@/modules/api/graphql/mutations/mutation-record-manual-evidence"
import { useGraphQLWithToast } from "@/modules/toast"

/** What the manual evidence admission gives its block. */
interface RecordManualEvidence {
    /** Admits one piece of manual evidence; undefined = the failure was toasted. `result.duplicate` = it was already recorded. */
    readonly record: (input: MutateRecordManualEvidenceRequest) => Promise<{ duplicate: boolean } | undefined>
    readonly isRecording: boolean
}

/** Admitting one piece of manual evidence to the accounting agent; each failure is toasted. */
export const useRecordManualEvidence = (): RecordManualEvidence => {
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateRecordManualEvidenceSwr()
    const record = useCallback(
        (input: MutateRecordManualEvidenceRequest) => runGraphQL(() => trigger(input), { showSuccessToast: false }),
        [runGraphQL, trigger],
    )
    return { record, isRecording: isMutating }
}

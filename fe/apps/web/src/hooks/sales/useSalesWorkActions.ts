import { useMutateDecideSalesDraftSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDecideSalesDraftSwr"
import { useMutateDecideSalesWorkItemSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDecideSalesWorkItemSwr"
import { useMutateHandoffToAccountingSwr } from "@/hooks/swr/api/graphql/mutations/useMutateHandoffToAccountingSwr"
import { useMutateRetryFailedStepSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRetryFailedStepSwr"
import type {
    DecideSalesDraftInput,
    DecideSalesWorkItemInput,
    HandoffToAccountingInput,
    RetryFailedStepInput,
} from "@/modules/api"
import type { SalesActionRunner } from "./useSalesActionRunner"

/** The Sales writes that queue work on the back end: draft and work item decisions, the accounting handoff and the retry. */
export const useSalesWorkActions = (runner: SalesActionRunner) => {
    const draft = useMutateDecideSalesDraftSwr()
    const decision = useMutateDecideSalesWorkItemSwr()
    const handoff = useMutateHandoffToAccountingSwr()
    const retry = useMutateRetryFailedStepSwr()
    return {
        decideDraft: (input: DecideSalesDraftInput) => runner.runQueued(() => draft.trigger(input)),
        decideWorkItem: (input: DecideSalesWorkItemInput) => runner.runQueued(() => decision.trigger(input)),
        handoffToAccounting: (input: HandoffToAccountingInput) => runner.runQueued(() => handoff.trigger(input)),
        retryFailedStep: (input: RetryFailedStepInput) => runner.runQueued(() => retry.trigger(input)),
        isMutating: draft.isMutating || decision.isMutating || handoff.isMutating || retry.isMutating,
    }
}

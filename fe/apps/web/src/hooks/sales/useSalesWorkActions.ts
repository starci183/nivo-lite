import {
    useMutateDecideSalesDraftSwr,
    useMutateDecideSalesWorkItemSwr,
    useMutateHandoffToAccountingSwr,
    useMutateRetryFailedStepSwr,
} from "@/hooks/swr"
import type {
    DecideSalesDraftRequest,
    DecideSalesWorkItemRequest,
    HandoffToAccountingRequest,
    RetryFailedStepRequest,
} from "@/modules/api"
import type { SalesActionRunner } from "./useSalesActionRunner"

/** The Sales writes that queue work on the back end: draft and work item decisions, the accounting handoff and the retry. */
export const useSalesWorkActions = (runner: SalesActionRunner) => {
    const draft = useMutateDecideSalesDraftSwr()
    const decision = useMutateDecideSalesWorkItemSwr()
    const handoff = useMutateHandoffToAccountingSwr()
    const retry = useMutateRetryFailedStepSwr()
    return {
        decideDraft: (input: DecideSalesDraftRequest) => runner.runQueued(() => draft.trigger(input)),
        decideWorkItem: (input: DecideSalesWorkItemRequest) => runner.runQueued(() => decision.trigger(input)),
        handoffToAccounting: (input: HandoffToAccountingRequest) => runner.runQueued(() => handoff.trigger(input)),
        retryFailedStep: (input: RetryFailedStepRequest) => runner.runQueued(() => retry.trigger(input)),
        isMutating: draft.isMutating || decision.isMutating || handoff.isMutating || retry.isMutating,
    }
}

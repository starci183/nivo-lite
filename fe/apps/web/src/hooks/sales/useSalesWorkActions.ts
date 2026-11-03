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
} from "@/hooks/swr"
import type { SalesActionRunner } from "./useSalesActionRunner"

type UseSalesWorkActionsResult = {
    decideDraft: (input: DecideSalesDraftRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    decideWorkItem: (input: DecideSalesWorkItemRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    handoffToAccounting: (input: HandoffToAccountingRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    retryFailedStep: (input: RetryFailedStepRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    isMutating: boolean
}

/** The Sales writes that queue work on the back end: draft and work item decisions, the accounting handoff and the retry. */
export const useSalesWorkActions = (runner: SalesActionRunner): UseSalesWorkActionsResult => {
    const draft = useMutateDecideSalesDraftSwr()
    const decision = useMutateDecideSalesWorkItemSwr()
    const handoff = useMutateHandoffToAccountingSwr()
    const retry = useMutateRetryFailedStepSwr()
    return {
        decideDraft: (
            input: DecideSalesDraftRequest,
        ): Promise<
            | {
                  errorCode: string | null
                  id: string
                  status: string
                  workItemId: string | null
              }
            | undefined
        > => runner.runQueued(() => draft.trigger(input)),
        decideWorkItem: (
            input: DecideSalesWorkItemRequest,
        ): Promise<
            | {
                  errorCode: string | null
                  id: string
                  status: string
                  workItemId: string | null
              }
            | undefined
        > => runner.runQueued(() => decision.trigger(input)),
        handoffToAccounting: (
            input: HandoffToAccountingRequest,
        ): Promise<
            | {
                  errorCode: string | null
                  id: string
                  status: string
                  workItemId: string | null
              }
            | undefined
        > => runner.runQueued(() => handoff.trigger(input)),
        retryFailedStep: (
            input: RetryFailedStepRequest,
        ): Promise<
            | {
                  errorCode: string | null
                  id: string
                  status: string
                  workItemId: string | null
              }
            | undefined
        > => runner.runQueued(() => retry.trigger(input)),
        isMutating: draft.isMutating || decision.isMutating || handoff.isMutating || retry.isMutating,
    }
}

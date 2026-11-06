"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"

/** What one chat mutation document takes and answers, as its generated file exports it. */
type ChatOperation<Request, Data> = (params: {
    readonly request: Request
    readonly headers: { readonly "X-Workspace-Id": string }
}) => Promise<{ readonly data?: Data | null | undefined }>

/** The key of one chat mutation in the SWR cache: its name and the workspace. */
type ChatMutationKey = readonly [string, string]

/**
 * One chat mutation of the active workspace: the operation runs with the workspace header, and what the hook answers is the payload of
 * the one field it selects (a refusal comes back inside it as data). A missing answer is a failure named after the operation.
 */
export const useChatMutation = <Request, Data, Payload>(
    name: string,
    workspaceId: string,
    operation: ChatOperation<Request, Data>,
    payloadOf: (data: Data) => Payload,
): SWRMutationResponse<Payload, Error, ChatMutationKey, Request> =>
    useSWRMutation(
        [name, workspaceId] as const,
        async ([, scope]: ChatMutationKey, { arg }: { readonly arg: Request }) => {
            const result = await operation({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error(`${name} answered no data`)
            return payloadOf(result.data)
        },
    )

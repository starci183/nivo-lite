"use client"

import { answeredData, readError } from "@/hooks/workspaceread"
import type { OperationData, WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { KeyedMutator, SWRConfiguration } from "swr"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import { useAppSelector } from "@/redux"
import { OFFICE_PAGE_SIZE } from "@/modules/office"
import { queryOfficeMessages } from "@/modules/api/graphql/queries/query-office-messages"
import type { QueryOfficeMessagesRequest } from "@/modules/api/graphql/queries/query-office-messages"

/** The SWR key of {@link useQueryOfficeMessagesSwr}. */
export const QUERY_OFFICE_MESSAGES_SWR_KEY = "QUERY_OFFICE_MESSAGES_SWR"

/** One read of the `officeMessages` query. */
const readOfficeMessages = async ([
    ,
    ,
    input,
]: WorkspaceReadKey<QueryOfficeMessagesRequest>): Promise<OfficeMessagesPage> =>
    answeredData(await queryOfficeMessages({ request: input }), QUERY_OFFICE_MESSAGES_SWR_KEY).officeMessages

/** What one read of the `officeMessages` query answers. */
type OfficeMessagesPage = OperationData<typeof queryOfficeMessages>["officeMessages"]

/** What the hook answers: the latest page with its SWR state beside the mutation that reads the earlier page. */
interface OfficeMessagesRead {
    readonly mutate: KeyedMutator<OfficeMessagesPage>
    readonly data: OfficeMessagesPage | undefined
    readonly error: unknown
    readonly isValidating: boolean
    readonly isLoading: boolean
    readonly earlier: SWRMutationResponse<OfficeMessagesPage, Error, "OFFICE_EARLIER_PAGE", TriggerArg["arg"]>
}

/** The back end `officeMessages` query. Pass `null` to wait for the arguments. */
export const useQueryOfficeMessagesSwr = (
    request: QueryOfficeMessagesRequest | null,
    config?: SWRConfiguration<OfficeMessagesPage>,
): OfficeMessagesRead => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const latest = useSWR(
        request === null || workspaceId === undefined
            ? null
            : ([QUERY_OFFICE_MESSAGES_SWR_KEY, workspaceId, request] as const),
        readOfficeMessages,
        config,
    )
    const earlier = useSWRMutation("OFFICE_EARLIER_PAGE", async (_key: string, { arg }: TriggerArg) => {
        const result = await queryOfficeMessages({
            request: { before: arg.before, limit: OFFICE_PAGE_SIZE, room: arg.room },
        })
        if (!result.data) throw new Error("officeMessages answered no data")
        return result.data.officeMessages
    })
    // Keep SWR's field subscriptions lazy when exposing the cursor read beside the latest page.
    return {
        mutate: latest.mutate,
        get data() {
            return latest.data
        },
        get error() {
            return readError(latest)
        },
        get isValidating() {
            return latest.isValidating
        },
        get isLoading() {
            return latest.isLoading
        },
        earlier,
    }
}

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: {
        readonly before: NonNullable<QueryOfficeMessagesRequest["before"]>
        readonly room: string | null
    }
}

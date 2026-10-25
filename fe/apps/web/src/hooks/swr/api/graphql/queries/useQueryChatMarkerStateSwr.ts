"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import type { ChatMarkerWire } from "@/modules/office"
import { queryChatMarkerState } from "@/modules/api/graphql/queries/query-chat-marker-state"
import type { QueryChatMarkerStateRequest } from "@/modules/api/graphql/queries/query-chat-marker-state"

/** The SWR key of {@link useQueryChatMarkerStateSwr}. */
export const QUERY_CHAT_MARKER_STATE_SWR_KEY = "QUERY_CHAT_MARKER_STATE_SWR"

/** One target of the `chatMarkerState` query and what the back end answered for it. */
interface ChatMarkerStateAnswer {
    readonly request: QueryChatMarkerStateRequest
    readonly state: ChatMarkerWire | undefined
}

/** The back end `chatMarkerState` query for one or several targets at once: one answer per target, in the order asked. */
export const useQueryChatMarkerStateSwr = (
    targets: ReadonlyArray<QueryChatMarkerStateRequest>,
    config?: SWRConfiguration<ReadonlyArray<ChatMarkerStateAnswer>>,
) =>
    useSWR(
        useWorkspaceKey(QUERY_CHAT_MARKER_STATE_SWR_KEY, [JSON.stringify(targets)]),
        async (): Promise<ReadonlyArray<ChatMarkerStateAnswer>> =>
            Promise.all(
                targets.map(async (request) => ({
                    request,
                    state: (await queryChatMarkerState({ request })).data?.chatMarkerState,
                })),
            ),
        config,
    )

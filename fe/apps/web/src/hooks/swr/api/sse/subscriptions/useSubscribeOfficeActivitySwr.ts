"use client"

import { useSWRConfig } from "swr"
import useSWRSubscription from "swr/subscription"
import { useViewerKeyId, useWorkspaceKey } from "@/hooks/workspaceKey"
import { streamOfficeActivity } from "@/modules/api/sse/office/stream-office-activity"
import type { OfficeActivityKind, OfficeActivityPush } from "@/modules/api/sse/office/stream-office-activity"
import { QUERY_CHAT_MARKER_STATE_SWR_KEY } from "../../graphql/queries/useQueryChatMarkerStateSwr"
import { QUERY_OFFICE_CONVERSATION_UNREAD_SWR_KEY } from "../../graphql/queries/useQueryOfficeConversationUnreadSwr"
import { QUERY_OFFICE_MESSAGES_SWR_KEY } from "../../graphql/queries/useQueryOfficeMessagesSwr"
import { QUERY_OFFICE_ROOMS_SWR_KEY } from "../../graphql/queries/useQueryOfficeRoomsSwr"

/** The SWR key of the office-activity stream; the full key carries the workspace and the signed-in reader, the identity of the stream. */
export const SUBSCRIBE_OFFICE_ACTIVITY_SWR_KEY = "SUBSCRIBE_OFFICE_ACTIVITY_SWR"

/** The key of the stream; null while nobody is signed in or no workspace is active. */
type OfficeActivityStreamKey = readonly [string, string, ...Array<string | null>] | null

/** The reads each kind of notification makes stale. */
const STALE_READS: Readonly<Record<OfficeActivityKind, ReadonlyArray<string>>> = {
    message: [QUERY_OFFICE_MESSAGES_SWR_KEY, QUERY_OFFICE_ROOMS_SWR_KEY, QUERY_OFFICE_CONVERSATION_UNREAD_SWR_KEY],
    receipt: [QUERY_OFFICE_MESSAGES_SWR_KEY, QUERY_CHAT_MARKER_STATE_SWR_KEY],
    unread: [QUERY_OFFICE_ROOMS_SWR_KEY, QUERY_OFFICE_CONVERSATION_UNREAD_SWR_KEY],
}

/** Every office read, for the snapshot a (re)connect takes. */
const ALL_READS: ReadonlyArray<string> = [
    QUERY_OFFICE_MESSAGES_SWR_KEY,
    QUERY_OFFICE_ROOMS_SWR_KEY,
    QUERY_OFFICE_CONVERSATION_UNREAD_SWR_KEY,
    QUERY_CHAT_MARKER_STATE_SWR_KEY,
]

/**
 * The notifications the back end pushes for the signed-in reader's Office (new lines, receipts, unread changes). Nobody signed in
 * or no workspace, no stream. The stream opens with the first reader of the key and closes with the last. Each frame revalidates
 * the office reads of the active workspace it makes stale, and each (re)open revalidates all of them once, which closes the gap
 * since the last frame. A refused or broken attempt is the hook's error until the next frame.
 */
export const useSubscribeOfficeActivitySwr = () => {
    const viewerId = useViewerKeyId()
    const { mutate } = useSWRConfig()
    const key = useWorkspaceKey(
        SUBSCRIBE_OFFICE_ACTIVITY_SWR_KEY,
        [viewerId ?? null],
        viewerId !== undefined && viewerId !== "signed-out",
    )
    return useSWRSubscription<OfficeActivityPush, Error, OfficeActivityStreamKey>(key, ([, workspaceId], { next }) => {
        const controller = new AbortController()
        const staleIn =
            (names: ReadonlyArray<string>) =>
            (read: unknown): boolean =>
                Array.isArray(read) && read[1] === workspaceId && names.includes(String(read[0]))
        void streamOfficeActivity({
            signal: controller.signal,
            onOpen: () => void mutate(staleIn(ALL_READS)),
            onPush: (push) => {
                next(null, push)
                void mutate(staleIn(STALE_READS[push.kind]))
            },
            report: (line) => next(new Error(line)),
        })
        return () => controller.abort()
    })
}

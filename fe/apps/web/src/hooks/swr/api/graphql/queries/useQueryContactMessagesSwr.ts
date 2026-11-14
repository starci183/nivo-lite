"use client"

import useSWRInfinite, { type SWRInfiniteResponse } from "swr/infinite"
import { queryContactMessages } from "@/modules/api/graphql/queries/query-contact-messages"
import type { ContactLineWire } from "@/modules/contacts"

/** The identity of the contact-messages cache. */
export const QUERY_CONTACT_MESSAGES_SWR_KEY = "QUERY_CONTACT_MESSAGES_SWR"

/** How many lines one page holds. */
const PAGE_SIZE = 30

/** One page of a person's conversation: the lines newest first and the cursor of the older page (null at the end). */
export interface ContactLinesPage {
    readonly rows: ReadonlyArray<ContactLineWire>
    readonly next: string | null
}

/** The key of one page: the workspace, the person, the route the page narrows to (empty: every route) and the cursor it starts after (empty: the newest page). */
type ContactMessagesKey = readonly [string, string, string, string, string]

/**
 * The conversation with a person, a page at a time: one merged read of every route, or of one route when `routeId` is given. `setSize`
 * asks the next, older page by the cursor of the page before. An undefined workspace or person waits.
 */
export const useQueryContactMessagesSwr = (
    workspaceId: string | undefined,
    contactId: string | undefined,
    routeId: string | null,
): SWRInfiniteResponse<ContactLinesPage, Error> =>
    useSWRInfinite(
        (index: number, previous: ContactLinesPage | null): ContactMessagesKey | null => {
            if (workspaceId === undefined || contactId === undefined) return null
            if (index > 0 && (previous?.next ?? null) === null) return null
            return [QUERY_CONTACT_MESSAGES_SWR_KEY, workspaceId, contactId, routeId ?? "", previous?.next ?? ""]
        },
        async ([, , person, route, cursor]: ContactMessagesKey): Promise<ContactLinesPage> => {
            const result = await queryContactMessages({
                request: {
                    contactId: person,
                    limit: PAGE_SIZE,
                    ...(route === "" ? {} : { routeId: route }),
                    ...(cursor === "" ? {} : { before: cursor }),
                },
            })
            if (!result.data) throw new Error("contactMessages answered no data")
            return result.data.contactMessages
        },
        { revalidateFirstPage: true },
    )

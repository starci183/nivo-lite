"use client"

import useSWRInfinite, { type SWRInfiniteResponse } from "swr/infinite"
import { queryContacts } from "@/modules/api/graphql/queries/query-contacts"
import type { ContactsQuery } from "@/modules/api"

/** The identity of the contacts cache. */
export const QUERY_CONTACTS_SWR_KEY = "QUERY_CONTACTS_SWR"

/** How many people one page of the list holds. */
const PAGE_SIZE = 30

/** The key of one page: the workspace, the search words and the cursor the page starts after (none for the first). */
type ContactsKey = readonly [string, string, string, string | null]

/**
 * The people of a workspace a page at a time, found by name, phone or e-mail: the first page is the newest activity and `setSize`
 * loads the next one by the cursor the back end gave. `workspaceId` undefined waits.
 */
export const useQueryContactsSwr = (
    workspaceId: string | undefined,
    search: string,
): SWRInfiniteResponse<ContactsQuery["contacts"], Error> =>
    useSWRInfinite(
        (index: number, previous: ContactsQuery["contacts"] | null): ContactsKey | null => {
            if (workspaceId === undefined) return null
            if (index > 0 && (previous?.next ?? null) === null) return null
            return [QUERY_CONTACTS_SWR_KEY, workspaceId, search, previous?.next ?? null]
        },
        async ([, scope, words, cursor]: ContactsKey) => {
            const result = await queryContacts({
                request: {
                    size: PAGE_SIZE,
                    ...(words === "" ? {} : { search: words }),
                    ...(cursor === null ? {} : { cursor }),
                },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("contacts answered no data")
            return result.data.contacts
        },
        { revalidateFirstPage: true },
    )

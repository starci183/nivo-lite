"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryContact } from "@/modules/api/graphql/queries/query-contact"
import type { ContactQuery } from "@/modules/api"

/** The SWR key of one person's detail; mutations that change a person revalidate the keys that lead with it. */
export const QUERY_CONTACT_SWR_KEY = "QUERY_CONTACT_SWR"

/** One person of the active workspace with identities, conversations, agent memory and suggestions (the back end `contact` query); `undefined` id waits. */
export const useQueryContactSwr = (id: string | undefined): ReadResponse<ContactQuery["contact"]> => {
    const key = useWorkspaceKey(QUERY_CONTACT_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(key, async ([, , contactId]: WorkspaceReadKey<string>) => {
        return answeredData(await queryContact({ request: { id: contactId } }), "contact").contact
    })
}

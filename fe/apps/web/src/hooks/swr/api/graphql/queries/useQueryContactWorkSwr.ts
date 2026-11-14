"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryContactWork } from "@/modules/api/graphql/queries/query-contact-work"
import type { ContactWorkQuery } from "@/modules/api"

/** The SWR key of the work done for one person; a change to a person revalidates the keys that lead with it. */
export const QUERY_CONTACT_WORK_SWR_KEY = "QUERY_CONTACT_WORK_SWR"

/** The work the agents did for one person, labelled and newest first (the back end `contactWork` query); `undefined` id waits. */
export const useQueryContactWorkSwr = (id: string | undefined): ReadResponse<ContactWorkQuery["contactWork"]> => {
    const key = useWorkspaceKey(QUERY_CONTACT_WORK_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(key, async ([, , contactId]: WorkspaceReadKey<string>) => {
        return answeredData(await queryContactWork({ request: { contactId } }), "contactWork").contactWork
    })
}

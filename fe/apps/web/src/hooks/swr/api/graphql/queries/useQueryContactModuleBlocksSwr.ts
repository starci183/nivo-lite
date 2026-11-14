"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryContactModuleBlocks } from "@/modules/api/graphql/queries/query-contact-module-blocks"
import type { ContactModuleBlocksQuery } from "@/modules/api"

/** The SWR key of what the installed modules know about one person; a change to a person revalidates the keys that lead with it. */
export const QUERY_CONTACT_MODULE_BLOCKS_SWR_KEY = "QUERY_CONTACT_MODULE_BLOCKS_SWR"

/** The blocks each installed agent's module mounts on one person, with the first rows its read gave (the back end `contactModuleBlocks` query); `undefined` id waits. */
export const useQueryContactModuleBlocksSwr = (
    id: string | undefined,
): ReadResponse<ContactModuleBlocksQuery["contactModuleBlocks"]> => {
    const key = useWorkspaceKey(QUERY_CONTACT_MODULE_BLOCKS_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(key, async ([, , contactId]: WorkspaceReadKey<string>) => {
        return answeredData(await queryContactModuleBlocks({ request: { contactId } }), "contactModuleBlocks").contactModuleBlocks
    })
}

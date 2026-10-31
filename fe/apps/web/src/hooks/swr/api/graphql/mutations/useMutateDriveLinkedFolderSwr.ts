"use client"

import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import { queryDriveLinkedFolder } from "@/modules/api/graphql/queries/query-drive-linked-folder"
import type { QueryDriveLinkedFolderRequest } from "@/modules/api/graphql/queries/query-drive-linked-folder"

/** The SWR key of the driveLinkedFolder read. */
export const MUTATE_DRIVE_LINKED_FOLDER_SWR_KEY = "MUTATE_DRIVE_LINKED_FOLDER_SWR"

/**
 * Reads on demand, when the owner presses "Read folder", the files of a Drive folder the workspace grant can open
 * (the back end `driveLinkedFolder` query): `trigger({ url })` answers the folder and rejects with the back end failure.
 */
export const useMutateDriveLinkedFolderSwr = () =>
    useSWRMutation(
        MUTATE_DRIVE_LINKED_FOLDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await queryDriveLinkedFolder({ request: arg }), MUTATE_DRIVE_LINKED_FOLDER_SWR_KEY)
                .driveLinkedFolder,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: QueryDriveLinkedFolderRequest
}

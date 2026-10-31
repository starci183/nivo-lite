"use client"

import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import { queryDrivePickedFolder } from "@/modules/api/graphql/queries/query-drive-picked-folder"
import type { QueryDrivePickedFolderRequest } from "@/modules/api/graphql/queries/query-drive-picked-folder"

/** The SWR key of the drivePickedFolder read. */
export const MUTATE_DRIVE_PICKED_FOLDER_SWR_KEY = "MUTATE_DRIVE_PICKED_FOLDER_SWR"

/**
 * Reads once, with the short-lived browser token Google Picker gave, the files of the folder the owner picked (the back end
 * `drivePickedFolder` query; the token is used for this call and never stored): `trigger({ folderId, token })` answers the folder.
 */
export const useMutateDrivePickedFolderSwr = () =>
    useSWRMutation(
        MUTATE_DRIVE_PICKED_FOLDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await queryDrivePickedFolder({ request: arg }), MUTATE_DRIVE_PICKED_FOLDER_SWR_KEY)
                .drivePickedFolder,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: QueryDrivePickedFolderRequest
}

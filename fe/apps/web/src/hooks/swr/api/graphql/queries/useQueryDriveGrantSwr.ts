"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryDriveGrant } from "@/modules/api/graphql/queries/query-drive-grant"

/** The SWR key of the Google Drive read grant of the workspace. */
export const QUERY_DRIVE_GRANT_SWR_KEY = "QUERY_DRIVE_GRANT_SWR"

/** The Google Drive read grant of the active workspace (the back end `driveGrant` query); nothing is read while `enabled` is false. */
export const useQueryDriveGrantSwr = (enabled = true) =>
    useSWR(
        useWorkspaceKey(QUERY_DRIVE_GRANT_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryDriveGrant({ signal })
            if (!result.data) throw new Error("driveGrant answered no data")
            return result.data.driveGrant
        },
    )

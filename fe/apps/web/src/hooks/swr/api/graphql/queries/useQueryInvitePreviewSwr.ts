"use client"

import useSWR from "swr"
import { queryInvitePreview } from "@/modules/api/graphql/queries/query-invite-preview"
import type { QueryInvitePreviewRequest } from "@/modules/api/graphql/queries/query-invite-preview"

/** The SWR key of the invitePreview query; mutations that change it call `mutate` with it. */
export const QUERY_INVITE_PREVIEW_SWR_KEY = "QUERY_INVITE_PREVIEW_SWR"

/** What an invitation link is for (public: callable without a session). */
export const useQueryInvitePreviewSwr = (request: QueryInvitePreviewRequest, enabled = true) =>
    useSWR(enabled ? [QUERY_INVITE_PREVIEW_SWR_KEY, request.token] : null, async () => {
        const result = await queryInvitePreview({ request })
        if (!result.data) throw new Error("invitePreview answered no data")
        return result.data.invitePreview
    })

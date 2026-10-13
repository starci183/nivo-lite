import useSWR from "swr"
import { queryFoundingMember } from "@/modules/api/graphql/queries/query-founding-member"

/** The SWR key of the foundingMember query. */
export const QUERY_FOUNDING_MEMBER_SWR_KEY = "QUERY_FOUNDING_MEMBER_SWR"

/** Whether the workspace is a founding member; idle until a workspace is selected. */
export const useQueryFoundingMemberSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_FOUNDING_MEMBER_SWR_KEY, workspaceId], async () => {
        const result = await queryFoundingMember()
        if (!result.data) throw new Error("foundingMember answered no data")
        return result.data.foundingMember
    })

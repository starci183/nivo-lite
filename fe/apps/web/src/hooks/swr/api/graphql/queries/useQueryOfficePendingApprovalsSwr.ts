import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryOfficePendingApprovals } from "@/modules/api/graphql/queries/query-office-pending-approvals"

/** The SWR key of {@link useQueryOfficePendingApprovalsSwr}. */
export const QUERY_OFFICE_PENDING_APPROVALS_SWR_KEY = "QUERY_OFFICE_PENDING_APPROVALS_SWR"

/** The back end `officePendingApprovals` query. */
export const useQueryOfficePendingApprovalsSwr = (config?: SWRConfiguration) =>
    useSWR(
        QUERY_OFFICE_PENDING_APPROVALS_SWR_KEY,
        async () => (await queryOfficePendingApprovals()).data?.officePendingApprovals,
        config,
    )

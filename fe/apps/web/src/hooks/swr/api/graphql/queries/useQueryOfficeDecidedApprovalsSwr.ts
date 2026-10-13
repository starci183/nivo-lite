import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryOfficeDecidedApprovals } from "@/modules/api/graphql/queries/query-office-decided-approvals"

/** The SWR key of {@link useQueryOfficeDecidedApprovalsSwr}. */
export const QUERY_OFFICE_DECIDED_APPROVALS_SWR_KEY = "QUERY_OFFICE_DECIDED_APPROVALS_SWR"

/** The back end `officeDecidedApprovals` query. */
export const useQueryOfficeDecidedApprovalsSwr = (config?: SWRConfiguration) =>
    useSWR(
        QUERY_OFFICE_DECIDED_APPROVALS_SWR_KEY,
        async () => (await queryOfficeDecidedApprovals()).data?.officeDecidedApprovals,
        config,
    )

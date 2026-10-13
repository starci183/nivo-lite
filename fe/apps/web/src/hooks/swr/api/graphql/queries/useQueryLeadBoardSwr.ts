import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLeadBoard } from "@/modules/api/graphql/queries/query-lead-board"

/** The SWR key of {@link useQueryLeadBoardSwr}. */
export const QUERY_LEAD_BOARD_SWR_KEY = "QUERY_LEAD_BOARD_SWR"

/** The back end `leadBoard` query. */
export const useQueryLeadBoardSwr = (config?: SWRConfiguration) =>
    useSWR(QUERY_LEAD_BOARD_SWR_KEY, async () => (await queryLeadBoard()).data?.leadBoard, config)

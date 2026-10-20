"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryOfficeRooms } from "@/modules/api/graphql/queries/query-office-rooms"

/** The SWR key of {@link useQueryOfficeRoomsSwr}. */
export const QUERY_OFFICE_ROOMS_SWR_KEY = "QUERY_OFFICE_ROOMS_SWR"

/** The back end `officeRooms` query. */
export const useQueryOfficeRoomsSwr = (config?: SWRConfiguration) =>
    useSWR(QUERY_OFFICE_ROOMS_SWR_KEY, async () => (await queryOfficeRooms()).data?.officeRooms, config)

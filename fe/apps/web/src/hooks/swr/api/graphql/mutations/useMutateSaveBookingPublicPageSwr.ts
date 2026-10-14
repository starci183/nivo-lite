"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveBookingPublicPage } from "@/modules/api/graphql/mutations/mutation-save-booking-public-page"
import type { MutateSaveBookingPublicPageRequest } from "@/modules/api/graphql/mutations/types/save-booking-public-page"

/** The SWR key of the `saveBookingPublicPage` mutation. */
export const MUTATE_SAVE_BOOKING_PUBLIC_PAGE_SWR_KEY = "MUTATE_SAVE_BOOKING_PUBLIC_PAGE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveBookingPublicPageRequest
}

/** Publishes or edits the public booking page of the workspace. */
export const useMutateSaveBookingPublicPageSwr = () =>
    useSWRMutation(MUTATE_SAVE_BOOKING_PUBLIC_PAGE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveBookingPublicPage({ request: arg })
        if (!result.data) throw new Error("saveBookingPublicPage answered no data")
        return result.data.saveBookingPublicPage
    })

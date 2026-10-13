import useSWRMutation from "swr/mutation"
import { mutateSaveBookingPublicPage } from "@/modules/api/graphql/mutations"
import type { MutateSaveBookingPublicPageRequest } from "@/modules/api/graphql/mutations/types/save-booking-public-page"

/** The SWR key of the `saveBookingPublicPage` mutation. */
export const MUTATE_SAVE_BOOKING_PUBLIC_PAGE_SWR_KEY = "MUTATE_SAVE_BOOKING_PUBLIC_PAGE_SWR"

/** Publishes or edits the public booking page of the workspace. */
export const useMutateSaveBookingPublicPageSwr = () =>
    useSWRMutation(MUTATE_SAVE_BOOKING_PUBLIC_PAGE_SWR_KEY, async (_key: string, { arg }: { arg: MutateSaveBookingPublicPageRequest }) => {
        const result = await mutateSaveBookingPublicPage({ request: arg })
        if (!result.data) throw new Error("saveBookingPublicPage answered no data")
        return result.data.saveBookingPublicPage
    })

"use client"

import useSWRMutation from "swr/mutation"
import { mutateLogoutOtherSessions } from "@/modules/api/graphql/mutations/mutation-logout-other-sessions"

/** The SWR key of the logoutOtherSessions mutation. */
export const MUTATE_LOGOUT_OTHER_SESSIONS_SWR_KEY = "MUTATE_LOGOUT_OTHER_SESSIONS_SWR"

/** SWR mutation for {@link mutateLogoutOtherSessions}: Signs the caller out of every other device. `trigger()` rejects with the back end failure. */
export const useMutateLogoutOtherSessionsSwr = () =>
    useSWRMutation(MUTATE_LOGOUT_OTHER_SESSIONS_SWR_KEY, async () => {
        const result = await mutateLogoutOtherSessions({})
        if (!result.data) throw new Error("logoutOtherSessions answered no data")
        return result.data.logoutOtherSessions
    })

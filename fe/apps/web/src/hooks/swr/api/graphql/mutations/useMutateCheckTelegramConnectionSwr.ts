"use client"

import useSWRMutation from "swr/mutation"
import { answeredData, argumentKey } from "@/hooks/workspaceread"
import { mutateCheckConnection } from "@/modules/api/graphql/mutations/mutation-check-connection"

/** The SWR key of the check of one Telegram connection; every block of its page reads the same answer under it. */
export const MUTATE_CHECK_TELEGRAM_CONNECTION_SWR_KEY = "MUTATE_CHECK_TELEGRAM_CONNECTION_SWR"

/**
 * SWR mutation that asks Telegram what it knows about one connection (the back end `checkConnection` mutation). The answer is kept
 * under the connection, so the header button, the check list, the tiles and the notices of the page read the same `data`; `undefined`
 * pauses it.
 */
export const useMutateCheckTelegramConnectionSwr = (connectionId: string | undefined) =>
    useSWRMutation(
        argumentKey(MUTATE_CHECK_TELEGRAM_CONNECTION_SWR_KEY, connectionId),
        async ([, id]: readonly [string, string]) =>
            answeredData(
                await mutateCheckConnection({ request: { connectionId: id } }),
                MUTATE_CHECK_TELEGRAM_CONNECTION_SWR_KEY,
            ).checkConnection,
    )

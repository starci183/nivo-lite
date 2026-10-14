"use client"

import { mutate } from "swr"
import { QUERY_SHIFTS_MINE_SWR_KEY, QUERY_SHIFTS_WORKBENCH_SWR_KEY } from "@/hooks/swr"

const SHIFTS_KEYS: ReadonlySet<string> = new Set([QUERY_SHIFTS_WORKBENCH_SWR_KEY, QUERY_SHIFTS_MINE_SWR_KEY])

const isShiftsKey = (key: unknown): boolean => {
    const name = Array.isArray(key) ? key[0] : key
    return typeof name === "string" && SHIFTS_KEYS.has(name)
}

/** Revalidates the workbench and the "my schedule" reads after a change to the schedule, the roster or a request. */
export const refreshShifts = async (): Promise<void> => {
    await mutate(isShiftsKey)
}

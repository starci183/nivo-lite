"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { SepayKeys } from "@/modules/types"
import { sepayKeySchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Shows the SePay webhook URL and API key again (owner): the one secret the owner must paste into SePay. */
export const writeSepayKey = async (input: unknown): Promise<Outcome<SepayKeys>> => {
    const parsed = sepayKeySchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<SepayKeys>(parsed.data)
}

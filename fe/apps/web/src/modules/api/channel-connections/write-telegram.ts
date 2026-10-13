"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { TelegramConnected } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Connects a Telegram bot (owner): the api checks the token, stores it encrypted and registers the bot's webhook. */
export const writeTelegram = async (input: unknown): Promise<Outcome<TelegramConnected>> => {
    const parsed = channelSchemas.telegram.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<TelegramConnected>(parsed.data)
}

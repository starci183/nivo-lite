import type { Secret } from "@modules/platform/config"

/** The secrets and the output of the connect-channel tool; a secret stays absent until the operator sets its variable. */
export interface ChannelProvisioningOptions {
    /** The bot token of the Telegram bot to connect (CHANNEL_BOT_TOKEN). */
    readonly telegramToken: Secret | undefined
    /** Prints one line to the operator. */
    readonly print: (line: string) => void
}

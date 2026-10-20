import type { Secret } from "@modules/platform/config"

/** The secrets and the output of the connect-channel tool; a secret stays absent until the operator sets its variable. */
export interface ChannelProvisioningOptions {
    /** The bot token of the Telegram bot to connect (CHANNEL_BOT_TOKEN). */
    readonly telegramToken: Secret | undefined
    /** The Zalo app id (ZALO_APP_ID). */
    readonly zaloAppId: string | undefined
    /** The Zalo app secret (ZALO_APP_SECRET, normally ZALO_APP_SECRET_FILE). */
    readonly zaloAppSecret: Secret | undefined
    /** The OA Secret Key that signs the webhooks (ZALO_OA_SECRET, normally ZALO_OA_SECRET_FILE). */
    readonly zaloOaSecret: Secret | undefined
    /** Prints one line to the operator. */
    readonly print: (line: string) => void
}

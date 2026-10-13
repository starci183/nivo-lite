/** Options of the channel-setup integration, parsed once at boot. */
export interface ChannelSetupOptions {
    /** The Zalo OAuth host; the real one when absent (a local fake otherwise). */
    readonly zaloOauthBase: string | undefined
    /** The public origin of the site, used for the Zalo callback address. */
    readonly siteUrl: string | undefined
    /** How long one provider call waits for the answer. */
    readonly timeoutMs: number
}

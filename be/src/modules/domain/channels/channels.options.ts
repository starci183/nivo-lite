/** Options of the channels capability. */
export interface ChannelsOptions {
    /** The public origin of the web app, used to build the OAuth return address of a provider; null on a development stack. */
    readonly siteUrl: string | null
}

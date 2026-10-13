/** The options of the hiring capability. */
export interface HiringOptions {
    /** The public origin of the web app, used to build the links candidates open; null on a development stack. */
    readonly siteUrl: string | null
}

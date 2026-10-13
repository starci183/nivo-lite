/** Options of the data-sources integration. */
export interface DataSourcesOptions {
    /** True on a development site: a database, mailbox or API on a private address may be reached. */
    readonly allowPrivateHosts: boolean
}

/** Options of the data-sources integration. */
export interface DataSourcesOptions {
    /** True on a development site: a database, mailbox or API on a private address may be reached. */
    readonly allowPrivateHosts: boolean
}

/** The integration bindings selected by the app composition root. */
export interface DataSourcesBindings {
    /** The public token of the document integration's file readers. */
    readonly documentReaders: symbol
}

/** Runtime options combine environment values with the app's selected integration bindings. */
export interface DataSourcesModuleOptions extends DataSourcesOptions, DataSourcesBindings {}

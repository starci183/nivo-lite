/** Where the n8n container runs and how the sync reaches it. */
export interface N8nHostOptions {
    /** The VPS host; undefined when none is configured. */
    readonly host: string | undefined
    /** The SSH user. */
    readonly user: string
    /** The SSH private key file. */
    readonly keyPath: string
    /** The known-hosts file, or undefined to use the default. */
    readonly knownHostsPath: string | undefined
    /** The name of the n8n container. */
    readonly container: string
    /** The resources folder; the workflows are the json files of its `n8n-templates` folder. */
    readonly root: string
}

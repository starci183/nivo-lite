/** What load one starter set of suppliers, items and recipes takes. */
export interface ApplyInventoryStarterRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The starter set key. */
    readonly key: string
}

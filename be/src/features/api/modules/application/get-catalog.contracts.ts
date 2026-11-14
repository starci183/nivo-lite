/** What reading the catalogue takes. */
export interface GetCatalogRequest {
    /**
     * The workspace the catalogue is shown to (the caller must be a member): it adds the modules of the private plugins that name the
     * workspace's enterprise identifier. Null: the modules of public plugins only.
     */
    readonly workspaceId: string | null
}

/** The chosen Page credentials parsed from an already sealed workspace connection secret. */
export interface LeadGenPageCredentials {
    /** The Page identity, checked against the connection's public metadata. */
    readonly pageId: string
    /** The provider token, used only by the worker. */
    readonly pageToken: string
}

/** What the app root decides for the SePay provider. */
export interface SepayProviderOptions {
    /**
     * True in the app that receives SePay's workspace-feed webhook (the API): it adds the webhook port, which reads the connections it
     * proves. An app that only answers the provider's MCP tools leaves it off.
     */
    readonly feedWebhook?: boolean
}

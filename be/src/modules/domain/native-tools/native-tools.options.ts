/**
 * The app root decides whether the capability is global and whether it answers for customers: `customer` adds the customer tool,
 * which reads the lead of a conversation and so belongs only to an app that runs the leads capability.
 */
export interface NativeToolsOptions {
    /** Adds `customer.brief`. */
    readonly customer?: boolean
    /** Provides the lead reader the customer tool reads with, for an app that does not run the leads capability (the mcp app). */
    readonly leadReader?: boolean
}

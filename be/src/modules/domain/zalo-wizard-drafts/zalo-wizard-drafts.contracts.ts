/** The keys the Zalo wizard handed over for one connection, waiting to be sealed. */
export interface WizardDraft {
    /** False when there is no draft: it was sealed already, or never written. */
    readonly present: boolean
    /** The Zalo app id; empty when this draft carries only the OA Secret Key. */
    readonly appId: string
    /** The Zalo app secret; empty when this draft carries only the OA Secret Key. */
    readonly appSecret: string
    /** The OA Secret Key; empty when this draft carries only the app keys. */
    readonly oaSecret: string
}

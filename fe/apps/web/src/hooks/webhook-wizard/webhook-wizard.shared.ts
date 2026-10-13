import type { Outcome } from "@/modules/api/outcome"
import type { WebhookTestVerdict, WebhookView } from "@/modules/types"

/** The steps of the webhook wizard, in order. */
export const WEBHOOK_STEPS = ["address", "secret", "test", "done"] as const

/** The commands the connected entry hands the webhook wizard (each one already knows the active workspace). A failure of `test` is keyed in the `connections` namespace, the others in `webhookWizard`. */
export interface WebhookActions {
    readonly start: (
        form: { readonly name: string; readonly url: string },
        events: ReadonlyArray<string>,
    ) => Promise<Outcome<WebhookView>>
    readonly test: (connectionId: string) => Promise<Outcome<WebhookTestVerdict>>
    readonly finish: (connectionId: string) => Promise<Outcome<true>>
}

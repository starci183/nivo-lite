import { SdkDefinitionError } from "../block/definition-error"
import type { WebhookEventConfig, WebhookEventDefinition } from "./webhook.types"

/** `<domain>.<verb>`: exactly two kebab-case ASCII parts. */
const EVENT_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/** A module key: kebab-case ASCII. */
const MODULE_KEY = /^[a-z][a-z0-9-]*$/

/**
 * Defines one outgoing event a plugin offers to webhook subscribers. Throws `SdkDefinitionError` `ID_MALFORMED` at module load for an
 * id that is not `<domain>.<verb>`, a module key that is not kebab-case or a label with an empty language.
 */
export const defineWebhookEvent = (config: WebhookEventConfig): WebhookEventDefinition => {
    if (!EVENT_ID.test(config.id)) throw new SdkDefinitionError("ID_MALFORMED", config.id)
    if (!MODULE_KEY.test(config.moduleKey)) throw new SdkDefinitionError("ID_MALFORMED", `${config.id}@${config.moduleKey}`)
    if (config.label.vi.trim() === "" || config.label.en.trim() === "") throw new SdkDefinitionError("ID_MALFORMED", `${config.id}.label`)
    return { ...config, entry: "webhook-event" }
}

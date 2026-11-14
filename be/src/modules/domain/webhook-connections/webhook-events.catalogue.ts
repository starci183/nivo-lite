import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { WebhookEventData } from "./webhook-connections.contracts"

/** One outgoing event a subscriber may pick: its id, its name and the line on when it fires, and the data a signed test delivery carries. */
export interface WebhookEventOption {
    /** The event id (`<domain>.<verb>`) a receiver filters on and a delivery carries. */
    readonly id: string
    /** The name the owner reads, in both product languages. */
    readonly label: Bilingual
    /** When it fires, in both product languages, or null. */
    readonly summary: Bilingual | null
    /** The data of its signed test delivery, besides `test: true`. */
    readonly sample: WebhookEventData
}

/**
 * The events the ENGINE itself raises, whatever plugins are installed: a person decided a work item (the `decision_made` bus event). Generic,
 * no business: every other event comes from the plugin whose business means it (`webhookEvents` of the installation).
 */
export const ENGINE_WEBHOOK_EVENTS: ReadonlyArray<WebhookEventOption> = [
    {
        id: "decision.made",
        label: { vi: "Ch\u1EE7 shop \u0111\u00E3 duy\u1EC7t ho\u1EB7c t\u1EEB ch\u1ED1i", en: "The owner approved or rejected something" },
        summary: { vi: "Khi m\u1ED9t ng\u01B0\u1EDDi duy\u1EC7t, s\u1EEDa ho\u1EB7c t\u1EEB ch\u1ED1i m\u1ED9t vi\u1EC7c.", en: "When a person approves, edits or rejects a work item." },
        sample: {},
    },
]

/** The engine's events then the plugins' declared ones, each id once (the engine's wins); the plugins' come in installation order. */
export const webhookEventOptions = (
    installed: ReadonlyArray<{ id: string; label: Bilingual; summary?: Bilingual | undefined; sample?: WebhookEventData | undefined }>,
): ReadonlyArray<WebhookEventOption> => {
    const taken = new Set<string>(ENGINE_WEBHOOK_EVENTS.map((event) => event.id))
    const declared: Array<WebhookEventOption> = []
    for (const event of installed) {
        if (taken.has(event.id)) continue
        taken.add(event.id)
        declared.push({ id: event.id, label: event.label, summary: event.summary ?? null, sample: event.sample ?? {} })
    }
    return [...declared, ...ENGINE_WEBHOOK_EVENTS]
}

/** The events the installed plugins and the engine offer now. */
export const installedWebhookEvents = (): ReadonlyArray<WebhookEventOption> => webhookEventOptions(INSTALLED.webhookEvents())

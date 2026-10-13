"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useWebhookWizard, WEBHOOK_STEPS } from "@/hooks/webhook-wizard"
import { WEBHOOK_EVENTS } from "@/lib/webhook-shared"
import type { WebhookEvent } from "@/lib/webhook-shared"
import type { WebhookTestVerdict } from "@/modules/types"
import { WebhookWizardBase } from "./component"

/** What the board hands the webhook wizard. */
interface WebhookWizardProps {
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** n8n / Make / Zapier webhook in the shared wizard frame: address and events, signing key, a test send, done. */
export const WebhookWizard = (props: WebhookWizardProps) => {
    const t = useTranslations("webhookWizard")
    const tw = useTranslations("connectionWizard")
    const copy = useCopyLabels()
    const wizard = useWebhookWizard({
        defaultName: t("defaultName"),
        onClose: props.onClose,
    })
    const eventLabels: Readonly<Record<WebhookEvent, string>> = {
        "lead.created": t("event_lead_created"),
        "deal.won": t("event_deal_won"),
        "order.confirmed": t("event_order_confirmed"),
        "payment.received": t("event_payment_received"),
        "handoff.requested": t("event_handoff_requested"),
        "decision.made": t("event_decision_made"),
    }
    const testOf = (result: WebhookTestVerdict) => {
        const took = t("testTook", { ms: result.durationMs })
        if (result.ok) return { isOk: true, title: t("testOk", { status: result.status ?? "" }), description: took }
        const reason = result.status === null ? t("testUnreachable") : t("testHttpError", { status: result.status })
        return { isOk: false, title: t("testFailed"), description: `${reason} ${took}` }
    }
    return (
        <WebhookWizardBase
            props={{
                title: t("title"),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: WEBHOOK_STEPS.length }),
                steps: [t("stepAddress"), t("stepSecret"), t("stepTest"), t("stepDone")],
                index: wizard.index,
                step: wizard.step,
                form: wizard.form,
                events: wizard.events,
                eventOptions: WEBHOOK_EVENTS.map((event) => ({ value: event, label: eventLabels[event] })),
                signingSecret: wizard.signingSecret,
                copy,
                n8nSteps: [t("n8nStep1"), t("n8nStep2"), t("n8nStep3")],
                snippet: String(t.raw("snippet")),
                test: wizard.test === null ? null : testOf(wizard.test),
                error: wizard.error,
                isPending: wizard.isPending,
                text: {
                    saveAndNext: t("saveAndNext"),
                    next: tw("next"),
                    back: tw("back"),
                    close: tw("close"),
                    finish: t("finish"),
                    sendTest: t("sendTest"),
                    sendAgain: t("sendAgain"),
                    fieldName: t("fieldName"),
                    fieldUrl: t("fieldUrl"),
                    urlHint: t("urlHint"),
                    urlPlaceholder: t("urlPlaceholder"),
                    eventsLabel: t("eventsLabel"),
                    secretIntro: t("secretIntro"),
                    secretLabel: t("secretLabel"),
                    n8nTitle: t("n8nTitle"),
                    n8nNote: t("n8nNote"),
                    codeLabel: t("codeLabel"),
                    testIntro: t("testIntro"),
                    testWarn: t("testWarn"),
                    doneIntro: t("doneIntro"),
                },
            }}
            on={wizard.on}
        />
    )
}

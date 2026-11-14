"use client"

import { type SlotRead, slotOfReads, useSlotLabels } from "@/hooks/slot"


import { useLocale, useTranslations } from "next-intl"
import { useCopyLabels, useWizardPhases } from "@/hooks/connection-wizard"
import { useQueryWebhookEventsSwr } from "@/hooks/swr"
import { useWebhookWizard, WEBHOOK_STEPS } from "@/hooks/webhook-wizard"
import type { WebhookTestVerdict } from "@/modules/types"
import { WebhookWizardBase } from "./component"

/** What the board hands the webhook wizard. */
interface WebhookWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** n8n / Make / Zapier webhook in the shared wizard frame: address and events, signing key, a test send, done. */
export const WebhookWizard = (props: WebhookWizardProps) => {
    const slotLabels = useSlotLabels()
    const t = useTranslations("webhookWizard")
    const tw = useTranslations("connectionWizard")
    const phases = useWizardPhases("webhook")
    const copy = useCopyLabels()
    const locale = useLocale()
    // The picker lists what the back end offers (the installed plugins' events and the engine's own); the name comes from the declaration.
    const available = useQueryWebhookEventsSwr()
    const eventOptions = (available.data ?? []).map((event) => ({
        value: event.id,
        label: locale === "en" ? event.label.en : event.label.vi,
    }))
    const wizard = useWebhookWizard({
        defaultName: t("defaultName"),
        availableEvents: eventOptions.map((option) => option.value),
        onClose: props.onClose,
    })
    const testOf = (result: WebhookTestVerdict) => {
        const took = t("testTook", { ms: result.durationMs })
        if (result.ok) return { isOk: true, title: t("testOk", { status: result.status ?? "" }), description: took }
        const reason = result.status === null ? t("testUnreachable") : t("testHttpError", { status: result.status })
        return { isOk: false, title: t("testFailed"), description: `${reason} ${took}` }
    }
    return (
        <WebhookWizardBase
            props={{
                boot: slotOfReads(props.dependencyReads, () => true),
                slotLabels: slotLabels(""),
                title: t("title"),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: WEBHOOK_STEPS.length }),
                phases,
                steps: [t("stepAddress"), t("stepSecret"), t("stepTest"), t("stepDone")],
                index: wizard.index,
                step: wizard.step,
                form: wizard.form,
                events: wizard.events,
                eventOptions,
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
                    secretOnce: t("secretOnce"),
                    n8nTitle: t("n8nTitle"),
                    n8nNote: t("n8nNote"),
                    n8nEmpty: t("n8nEmpty"),
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

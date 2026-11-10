"use client"

import type { SlotRead } from "@/hooks/slot"

import { slotOfReads, useSlotLabels } from "@/hooks/slot"

import { useTranslations } from "next-intl"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { providerKey } from "@/hooks/connection-providers"
import { SMTP_STEPS, useSmtpView, useSmtpWizard } from "@/hooks/smtp-wizard"
import { SmtpWizardBase } from "./component"

/** What the board hands the outgoing-email wizard. */
interface SmtpWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** The signed-in person's email: the default address for the test message. */
    readonly ownerEmail: string
    /** The workspace already has a default sender, so this one starts as a spare. */
    readonly hasDefault: boolean
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Outgoing email in the shared wizard frame: where the mailbox lives, a guide, the sender details, one real test email. */
export const SmtpWizard = (props: SmtpWizardProps) => {
    const slotLabels = useSlotLabels()
    const tw = useTranslations("connectionWizard")
    const phases = useWizardPhases("smtp")
    const tc = useTranslations("connections")
    const wizard = useSmtpWizard({
        ownerEmail: props.ownerEmail,
        hasDefault: props.hasDefault,
        onClose: props.onClose,
    })
    const view = useSmtpView({
        preset: wizard.preset,
        choice: wizard.choice,
        fields: wizard.fields,
        isLocked: wizard.isLocked,
        needsPassword: wizard.needsPassword,
    })
    return (
        <SmtpWizardBase
            props={{
                boot: slotOfReads(props.dependencyReads, () => true),
                slotLabels: slotLabels(""),
                title: tw("title", { provider: tc(providerKey("smtp", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: SMTP_STEPS.length }),
                phases,
                steps: view.steps,
                index: wizard.index,
                step: wizard.step,
                presets: view.presets,
                presetId: wizard.preset.id,
                modes: view.modes,
                modeId: wizard.choice.modeId,
                guide: view.guide,
                account: view.account,
                isLocked: wizard.isLocked,
                isReady: wizard.isReady,
                testTo: wizard.test.to,
                makeDefault: wizard.test.makeDefault,
                sentNote: wizard.test.sentTo === null ? null : view.sentNote(wizard.test.sentTo),
                sendLabel: wizard.isPending ? view.text.testSending : view.text.testSend,
                error: wizard.error,
                isPending: wizard.isPending,
                text: view.text,
            }}
            on={wizard.on}
        />
    )
}

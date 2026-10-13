"use client"

import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { SMTP_STEPS, useSmtpView, useSmtpWizard } from "@/hooks/smtp-wizard"
import { sendSmtpTest, startSmtpConnection } from "@/lib/email-actions"
import { SmtpWizardBase } from "./component"

/** What the board hands the outgoing-email wizard. */
interface SmtpWizardProps {
    /** The signed-in person's email: the default address for the test message. */
    readonly ownerEmail: string
    /** The workspace already has a default sender, so this one starts as a spare. */
    readonly hasDefault: boolean
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Outgoing email in the shared wizard frame: where the mailbox lives, a guide, the sender details, one real test email. */
export const SmtpWizard = (props: SmtpWizardProps) => {
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const wizard = useSmtpWizard({
        ownerEmail: props.ownerEmail,
        hasDefault: props.hasDefault,
        onClose: props.onClose,
        actions: { start: startSmtpConnection, sendTest: sendSmtpTest },
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
                title: tw("title", { provider: tc(providerKey("smtp", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: SMTP_STEPS.length }),
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

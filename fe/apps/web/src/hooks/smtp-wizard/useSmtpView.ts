"use client"

import { modeOf, SMTP_PRESETS } from "@/modules/mail"
import type { SmtpPreset } from "@/modules/mail"
import type { SmtpAccountView, SmtpGuideView, SmtpOption, SmtpText } from "@/modules/types"
import { useTranslations } from "next-intl"
import type { SmtpChoice, SmtpFields } from "./smtp-wizard.shared"

/** What the view reads of the wizard state. */
interface SmtpViewInput {
    readonly preset: SmtpPreset
    readonly choice: SmtpChoice
    readonly fields: SmtpFields
    readonly isLocked: boolean
    readonly needsPassword: boolean
}

/** The outgoing-email wizard's words in the reader's language: the provider lists, the chosen guide, the sender form and the fixed labels. */
export const useSmtpView = (input: SmtpViewInput) => {
    const t = useTranslations("email")
    const say = useTranslations("smtpPresets")
    const mode = modeOf(input.preset, input.choice.modeId)
    const security = (value: string): string => (value === "tls" ? t("secTls") : t("secStarttls"))
    const prefilled = (host: string, port: string | number, value: string): string =>
        t("prefilled", { host, port, security: security(value) })

    const presets: ReadonlyArray<SmtpOption> = SMTP_PRESETS.map((item) => ({
        value: item.id,
        label: say(item.title),
        description: say(item.blurb),
    }))
    const modes: ReadonlyArray<SmtpOption> = input.preset.modes.map((item) => ({
        value: item.id,
        label: say(item.label),
        description: say(item.when),
    }))
    const guide: SmtpGuideView = {
        modeLabel: say(mode.label),
        when: say(mode.when),
        prefilled: mode.host === "" ? null : prefilled(mode.host, mode.port, mode.security),
        steps: mode.steps.map((item) => ({
            text: say(item.text),
            link: item.link === undefined ? null : { label: say(item.link.label), url: item.link.url },
        })),
        caution: mode.cautions.length === 0 ? null : mode.cautions.map((caution) => say(caution)).join(" "),
    }
    const account: SmtpAccountView = {
        values: input.fields,
        host: input.choice.host,
        port: input.choice.port,
        security: input.choice.security,
        securityOptions: [
            { id: "starttls", label: `${t("secStarttls")} (587)` },
            { id: "tls", label: `${t("secTls")} (465)` },
        ],
        showHost: Boolean(mode.hostEditable),
        showUser: Boolean(mode.hostEditable) || (!mode.userIsEmail && mode.fixedUser === undefined),
        showPassword: input.needsPassword,
        passwordLabel: say(mode.passLabel),
        passwordHint: input.isLocked ? undefined : say(mode.passHint),
        fixedUserNote: mode.fixedUser === undefined ? null : t("fixedUser", { user: mode.fixedUser }),
        prefilledNote:
            !mode.hostEditable && mode.host !== ""
                ? prefilled(input.choice.host, input.choice.port, input.choice.security)
                : null,
    }
    const text: SmtpText = {
        ...textLabelsOf(t),
    }
    return {
        presets,
        modes,
        guide,
        account,
        text,
        sentNote: (to: string): string => t("testOk", { to }),
        steps: [t("stepProvider"), t("stepGuide"), t("stepAccount"), t("stepVerify")],
    }
}

/** Resolves the text labels for the current locale. */
const textLabelsOf = (t: ReturnType<typeof useTranslations<"email">>) => ({
    back: t("back"),
    next: t("next"),
    close: t("close"),
    done: t("done"),
    saveContinue: t("saveContinue"),
    testSend: t("testSend"),
    testSending: t("testSending"),
    chooseHint: t("chooseHint"),
    modeTitle: t("modeTitle"),
    stepsTitle: t("stepsTitle"),
    cautionTitle: t("cautionTitle"),
    fieldFromName: t("fieldFromName"),
    fieldFromNameHint: t("fieldFromNameHint"),
    fieldFromEmail: t("fieldFromEmail"),
    fieldFromEmailHint: t("fieldFromEmailHint"),
    fieldReplyTo: t("fieldReplyTo"),
    fieldReplyToHint: t("fieldReplyToHint"),
    fieldHost: t("fieldHost"),
    fieldPort: t("fieldPort"),
    fieldSecurity: t("fieldSecurity"),
    fieldUser: t("fieldUser"),
    fieldUserHint: t("fieldUserHint"),
    passwordStored: t("passwordStored"),
    notConnectedYet: t("notConnectedYet"),
    testToLabel: t("testTo"),
    testToHint: t("testToHint"),
    makeDefault: t("makeDefault"),
    makeDefaultHint: t("makeDefaultHint"),
    stepProvider: t("stepProvider"),
})

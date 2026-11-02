"use client"

import { useTranslations } from "next-intl"

/** Owns the mailbox field and action words; pending remains the actual mutation flag. */
export const useImapCopy = (isPending: boolean) => {
    const t = useTranslations("connectorImap")
    return {
        fields: {
            name: t("fieldName"),
            nameHint: t("fieldNameHint"),
            email: t("fieldEmail"),
            provider: t("fieldProvider"),
            host: t("fieldHost"),
            port: t("fieldPort"),
            security: t("fieldSecurity"),
            user: t("fieldUser"),
            userHint: t("fieldUserHint"),
            password: t("fieldPassword"),
        },
        text: {
            back: t("back"),
            next: t("next"),
            close: t("close"),
            done: t("done"),
            save: isPending ? t("saving") : t("save"),
            test: isPending ? t("testing") : t("test"),
            intro: t("intro"),
            imapOn: t("imapOn"),
            foldersTitle: t("foldersTitle"),
            foldersHint: t("foldersHint"),
            sinceTitle: t("sinceTitle"),
            sinceHint: t("sinceHint"),
            scheduleHint: t("scheduleHint"),
            scheduleLabel: t("stepSchedule"),
            saved: t("agentSaved"),
        },
    }
}

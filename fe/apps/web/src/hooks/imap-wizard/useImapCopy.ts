"use client"

import { useTranslations } from "next-intl"

/** The view `useImapCopy` returns. */
export interface ImapCopyView {
    fields: {
        name: string
        nameHint: string
        email: string
        provider: string
        host: string
        port: string
        security: string
        user: string
        userHint: string
        password: string
    }
    text: {
        back: string
        next: string
        close: string
        done: string
        save: string
        test: string
        intro: string
        imapOn: string
        foldersTitle: string
        foldersHint: string
        sinceTitle: string
        sinceHint: string
        scheduleHint: string
        scheduleLabel: string
        saved: string
    }
}

/** Owns the mailbox field and action words; pending remains the actual mutation flag. */
export const useImapCopy = (isPending: boolean): ImapCopyView => {
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

"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { providerLabelOf, providerLogoOf } from "@/hooks/providerRights"
import type { SandboxWords } from "@/modules/sandbox"
import type { SandboxCopy } from "@/modules/types"

/** What the page says: its words and the words its data is worded with. */
export interface SandboxTexts {
    readonly copy: SandboxCopy
    readonly words: SandboxWords
}

/** A reader of the `sandbox` catalog. */
type Say = ReturnType<typeof useTranslations<"sandbox">>

/** The words of the page itself: its header, its notices and the accounts block. */
const pageCopyOf = (
    t: Say,
    retryLabel: string,
): Pick<
    SandboxCopy,
    | "title"
    | "description"
    | "openAction"
    | "cancelLabel"
    | "offTitle"
    | "offBody"
    | "staffTitle"
    | "staffBody"
    | "failTitle"
    | "failBody"
    | "retryLabel"
    | "accounts"
    | "open"
> => ({
    title: t("title"),
    description: t("description"),
    openAction: t("openAction"),
    cancelLabel: t("cancel"),
    offTitle: t("offTitle"),
    offBody: t("offBody"),
    staffTitle: t("staffTitle"),
    staffBody: t("staffBody"),
    failTitle: t("failTitle"),
    failBody: t("failBody"),
    retryLabel,
    accounts: {
        title: t("accountsTitle"),
        listLabel: t("accountsLabel"),
        badge: t("accountBadge"),
        emptyTitle: t("accountsEmptyTitle"),
        emptyBody: t("accountsEmptyBody"),
    },
    open: {
        title: t("openTitle"),
        hint: t("openHint"),
        providerLabel: t("providerLabel"),
        nameLabel: t("nameLabel"),
        submitLabel: t("openSubmit"),
        agentsLabel: t("openAgentsLabel"),
    },
})

/** The words of the blocks of the open account and of the parked runs. */
const blockCopyOf = (t: Say): Pick<SandboxCopy, "cases" | "calls" | "webhookKey" | "waiting" | "agents" | "attach"> => ({
    agents: {
        title: t("agentsTitle"),
        empty: t("agentsEmpty"),
        attachLabel: t("agentsAttach"),
        detachLabel: t("agentsDetach"),
        makeDefaultLabel: t("agentsMakeDefault"),
        defaultBadge: t("agentsDefault"),
        errorTitle: t("errorAgents"),
        detachTitle: t("detachTitle"),
        detachBody: t("detachBody"),
        detachConfirm: t("agentsDetach"),
    },
    attach: {
        title: t("attachTitle"),
        hint: t("attachHint"),
        agentsLabel: t("attachAgentsLabel"),
        empty: t("attachEmpty"),
        submitLabel: t("attachSubmit"),
    },
    cases: {
        title: t("casesTitle"),
        empty: t("casesEmpty"),
        sendLabel: t("caseSend"),
        pickLabel: t("casePick"),
        defaultBadge: t("caseDefault"),
        nextBadge: t("caseNext"),
        inputsLabel: t("inputsLabel"),
        errorTitle: t("errorCases"),
    },
    calls: {
        title: t("callsTitle"),
        empty: t("callsEmpty"),
        moreLabel: t("callsMore"),
        clearLabel: t("callsClear"),
        failedBadge: t("callFailed"),
        errorTitle: t("errorCalls"),
        clearTitle: t("clearTitle"),
        clearBody: t("clearBody"),
        clearConfirm: t("callsClear"),
    },
    webhookKey: {
        title: t("keyTitle"),
        hint: t("keyHint"),
        revealLabel: t("keyReveal"),
        hideLabel: t("keyHide"),
        copyLabel: t("keyCopy"),
        errorTitle: t("errorKey"),
    },
    waiting: {
        title: t("waitingTitle"),
        empty: t("waitingEmpty"),
        expireLabel: t("waitingExpire"),
        errorTitle: t("errorWaiting"),
        leftTemplate: String(t.raw("waitingLeft")),
        dueLabel: t("waitingDue"),
    },
})

/** Reads the words of the Sandbox page from the `sandbox` catalog, the reader's formats for numbers and moments, and the provider names. */
export const useSandboxCopy = (): SandboxTexts => {
    const t = useTranslations("sandbox")
    const shell = useTranslations("shell")
    const format = useFormatter()
    const locale = useLocale()
    return {
        copy: { ...pageCopyOf(t, shell("retry")), ...blockCopyOf(t) },
        words: {
            latest: (values) => t("latestLine", { values }),
            next: (operation, caseId) => t("nextLine", { operation, caseId }),
            number: (value) => format.number(value),
            time: (iso) =>
                format.dateTime(new Date(iso), {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                }),
            inbound: t("callInbound"),
            waitingWhat: (verbs) => t("waitingWhat", { verbs }),
            waitingWhatAny: t("waitingWhatAny"),
            agentsLine: (names) => (names.length === 0 ? t("agentsNone") : names.join(", ")),
            defaultName: (provider) => t("defaultName", { provider: providerLabelOf(undefined, provider, locale) }),
            providerName: (provider) => providerLabelOf(undefined, provider, locale),
            providerLogo: (provider) => providerLogoOf(provider) ?? null,
        },
    }
}

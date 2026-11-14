import type { useTranslations } from "next-intl"
import type { TeamChatMessagesCopy } from "@/modules/types"

/** The translator of the team chat words. */
type Words = ReturnType<typeof useTranslations<"teamChat">>

/** The words of the cards and controls of a thread. */
export const messagesCopyOf = (t: Words, locale: string): TeamChatMessagesCopy => ({
    pin: t("pin"),
    unpin: t("unpin"),
    pinned: t("pinned"),
    report: t("reportBadge"),
    approvalTitle: t("approvalTitle"),
    approvalNeeded: t("approvalNeeded"),
    approvalRows: {
        step: t("approvalRowStep"),
        account: t("approvalRowAccount"),
        tool: t("approvalRowTool"),
        node: t("approvalRowNode"),
        locale: locale === "en" ? "en" : "vi",
        details: t("approvalDetails"),
        technical: t("approvalTechnical"),
    },
    relatedWork: t("relatedWork"),
    runName: t("runName"),
    workName: t("workName"),
    intentNotify: t("intentNotify"),
    orderTotal: t("orderTotal"),
    orderCustomer: t("orderCustomer"),
    orderDeliver: t("orderDeliver"),
    openConnections: t("openConnections"),
    agentFrom: t("agentFrom"),
    approvalPending: t("approvalPending"),
    approvalApproved: t("approvalApproved"),
    approvalRefused: t("approvalRefused"),
    approvalExpired: t("approvalExpired"),
    approve: t("approve"),
    refuse: t("refuse"),
    olderLabel: t("older"),
    noticeOpen: t("noticeOpen"),
    noticeClose: t("noticeClose"),
    orderOpen: t("orderOpen"),
    decidedBy: t("decidedBy"),
    reactions: {
        toolbar: t("reactToolbar"),
        reply: t("reactReply"),
        share: t("reactShare"),
        react: (emoji) => t("reactEmoji", { emoji }),
        pill: (summary, mine) => (mine <= 1 ? t("reactPillOnce", { summary }) : t("reactPill", { summary, mine })),
        forwarded: (name) => t("forwardedFrom", { name }),
        forwardedUnknown: t("forwardedUnknown"),
        repliedTo: (name) => t("repliedTo", { name }),
    },
})

import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { BadgeTone } from "@starci/grammar/common"
import type { useQueryAgentDashboardSwr } from "@/hooks/swr"
import { agentTypeName } from "@/modules/catalog"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES, agentChatHref } from "@/modules/routes"
import type { AccountingDashboardSectionView, AccountingDashboardView } from "@/modules/types"

type DashboardData = NonNullable<ReturnType<typeof useQueryAgentDashboardSwr>["data"]>
type DashboardTranslator = ReturnType<typeof useTranslations>
type DashboardFormat = ReturnType<typeof useFormatter>
type SectionKey = "waiting" | "done" | "conn" | "gaps"
type DashboardItem = Extract<DashboardData["waiting"], { readonly ok: true }>["data"]["items"][number]

const STATUS_TONES: Readonly<Record<"connected" | "error" | "pending", BadgeTone>> = {
    connected: "success",
    error: "danger",
    pending: "neutral",
}

/** Keeps every region's resolved empty and failure copy in one display contract. */
const sectionOf = (t: DashboardTranslator, key: SectionKey, hasFailed: boolean): AccountingDashboardSectionView => ({
    label: t(`${key}Title`),
    empty: t(`${key}Empty`),
    emptyBody: t(`${key}EmptyBody`),
    failedDescription: `${t(`${key}Title`)}. ${t("regionFailedText")}`,
    hasFailed,
    rows: [],
})

/** Uses the connected formatter for list timestamps; missing timestamps have no suffix. */
const timeOf = (format: DashboardFormat, iso: string | null): string => {
    if (iso === null) return ""
    return format.dateTime(new Date(iso), {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/** Resolves the common evidence-row description before either waiting or done draws it. */
const rowOf = (format: DashboardFormat, item: DashboardItem) => ({
    id: item.id,
    title: item.title,
    description: [item.description, timeOf(format, item.at)].filter(Boolean).join(" · "),
})

/** Maps knowledge counts and audience into two plain display rows. */
const knowledgeOf = (
    t: DashboardTranslator,
    data: DashboardData["knowledge"] | undefined,
): AccountingDashboardSectionView => {
    const region: AccountingDashboardSectionView = {
        label: t("knowTitle"),
        empty: t("knowPublic"),
        emptyBody: "",
        failedDescription: `${t("knowTitle")}. ${t("regionFailedText")}`,
        hasFailed: data?.ok !== true,
        rows: [],
        link: { href: KNOWLEDGE_ROUTES.library, label: t("knowOpen") },
    }
    if (data?.ok !== true) return region
    const knowledge = data.data
    const internal = knowledge.audience === "internal"
    const restricted = knowledge.facts.restricted > 0 ? t("knowRestricted", { n: knowledge.facts.restricted }) : ""
    const internalDescription = [
        t("knowCounts", { docs: knowledge.documents.internal, facts: knowledge.facts.internal }),
        restricted,
    ]
        .filter(Boolean)
        .join(" · ")
    return {
        ...region,
        footer: internal ? t("knowAudienceInternal") : t("knowAudienceCustomer"),
        rows: [
            {
                id: "public",
                title: t("knowPublic"),
                description: t("knowCounts", { docs: knowledge.documents.public, facts: knowledge.facts.public }),
            },
            {
                id: "internal",
                title: t("knowInternal"),
                description: internal ? internalDescription : t("knowInternalOff"),
            },
        ],
    }
}

/** Resolves the accounting frame's shared regions and header before the pure drawing receives them. */
export const useAccountingDashboardView = (dashboard: DashboardData | undefined): AccountingDashboardView => {
    const t = useTranslations("agentDashboard")
    const locale = useLocale()
    const format = useFormatter()
    const agent = dashboard?.agent
    const waiting = dashboard?.waiting
    const done = dashboard?.done
    const connections = dashboard?.connections
    const knowledge = dashboard?.knowledge
    let waitingView = sectionOf(t, "waiting", waiting?.ok !== true)
    let doneView = sectionOf(t, "done", done?.ok !== true)
    let connectionView = sectionOf(t, "conn", connections?.ok !== true)
    let gaps: AccountingDashboardSectionView | null = null
    if (knowledge?.ok === true && knowledge.data.gaps !== null) {
        const data = knowledge.data.gaps
        gaps = {
            ...sectionOf(t, "gaps", false),
            badge:
                data.openCount > 0 ? { label: format.number(data.openCount), tone: "warning", isDot: true } : undefined,
            link: data.openCount > 0 ? { href: KNOWLEDGE_ROUTES.library, label: t("gapsOpen") } : undefined,
            rows: data.items.map((item) => ({
                id: item.id,
                title: item.question,
                description: timeOf(format, item.lastSeenAt),
                badges: [{ label: t("gapAsked", { n: item.count }), tone: "warning" }],
            })),
        }
    }
    if (waiting?.ok === true) {
        const data = waiting.data
        waitingView = {
            ...waitingView,
            badge: data.total > 0 ? { label: format.number(data.total), tone: "warning", isDot: true } : undefined,
            footer:
                data.total > data.items.length ? t("waitingMore", { n: data.total - data.items.length }) : undefined,
            rows: data.items.map((item) => ({
                ...rowOf(format, item),
                action: { href: item.href, label: t("waitingOpen") },
            })),
        }
    }
    if (done?.ok === true) {
        doneView = {
            ...doneView,
            badge: { label: t("doneCount", { n: done.data.count }), tone: "success", isDot: true },
            rows: done.data.items.map((item) => ({
                ...rowOf(format, item),
                href: item.href,
            })),
        }
    }
    if (connections?.ok === true) {
        connectionView = {
            ...connectionView,
            rows: connections.data.map((item) => ({
                id: item.id,
                title: item.name,
                description: `${item.providerLabel} · ${t(`connPurpose_${item.purpose}`)}`,
                badges: [
                    { label: t(`connStatus_${item.status}`), tone: STATUS_TONES[item.status], isDot: true },
                    { label: t(`connAccess_${item.access}`), tone: "neutral" },
                ],
            })),
        }
    }
    const modeLabel = t(agent?.mode === "autopilot" ? "modeAutopilot" : "modeAssist")
    const modeTone = agent?.mode === "autopilot" ? "success" : "accent"
    return {
        heading: agent?.name || agentTypeName("accounting", locale === "en" ? "en" : "vi"),
        mode: agent
            ? {
                  label: modeLabel,
                  tone: modeTone,
                  isDot: true,
              }
            : null,
        chat: agent ? { href: agentChatHref(agent.id), label: t("commandChat") } : null,
        labels: {
            failure: t("regionFailed"),
            failureBody: t("regionFailedText"),
            retry: t("retry"),
            ribbon: t("ribbonAria"),
            tabs: t("tabsLabel"),
        },
        waiting: waitingView,
        done: {
            ...doneView,
            link: { href: `${CONSOLE_ROUTES.decisions}?kind=policy&dept=accounting`, label: t("doneLog") },
        },
        connections: { ...connectionView, link: { href: CONSOLE_ROUTES.connections, label: t("connManage") } },
        knowledge: knowledgeOf(t, knowledge),
        gaps,
    }
}

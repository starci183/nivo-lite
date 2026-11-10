"use client"

import { useTranslations } from "next-intl"
import { useConsoleNav } from "@/hooks/console"
import { useStaffHome } from "@/hooks/staffHome"
import type { StaffHomeData } from "@/hooks/staffHome"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE, CONSOLE_ROUTES, chatRoomHref, workspaceHref } from "@/modules/routes"
import { StaffHomeBase } from "./component"
import type { StaffHomeList, StaffHomeRow } from "./types"

/** The words of the page: a key of the `staffHome` catalog and its values. */
type Words = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** The shortcuts a rail destination has a line for. */
const SHORTCUT_KEYS: ReadonlySet<string> = new Set(["inbox", "chat", "brain", "authority", "modules"])

/** The count as a short fact after a title, or null when there is nothing to count. */
const factOf = (count: number): string | null => (count === 0 ? null : String(count))

/** What waits for the person: the work given to them, the customers who wait for a person, and the findings of the review that are theirs. */
const workOf = (data: StaffHomeData, t: Words, href: (path: string) => string): StaffHomeList => {
    const rows: StaffHomeRow[] = []
    if ((data.assigned ?? 0) > 0)
        rows.push({
            id: "assigned",
            title: t("workAssigned", { n: data.assigned ?? 0 }),
            description: t("workAssignedBody"),
            icon: "review",
            href: href(AGENTS_ROUTE),
        })
    if ((data.needsYou ?? 0) > 0)
        rows.push({
            id: "needs",
            title: t("workNeeds", { n: data.needsYou ?? 0 }),
            description: t("workNeedsBody"),
            icon: "email",
            href: href(CONSOLE_ROUTES.inbox),
        })
    for (const finding of data.findings)
        rows.push({
            id: finding.id,
            title: finding.title,
            description: finding.dossierName ?? t("workFindingBody"),
            icon: "brain",
            href: href(finding.path),
        })
    return {
        title: t("workTitle"),
        fact: factOf(rows.length),
        rows,
        isLoading: data.isWorkLoading || data.needsYou === undefined,
        emptyTitle: t("workEmptyTitle"),
        emptyBody: t("workEmptyBody"),
        emptyIcon: "complete",
        more: null,
    }
}

/** The recent chats, the unread ones marked with their count. */
const chatsOf = (data: StaffHomeData, t: Words, href: (path: string) => string): StaffHomeList => ({
    title: t("chatsTitle"),
    fact: (data.unread ?? 0) > 0 ? t("chatsUnreadFact", { n: data.unread ?? 0 }) : null,
    rows: data.rooms.map((room) => ({
        id: room.id,
        title: room.title,
        description: room.preview,
        icon: "chat" as const,
        ...(room.unread > 0 ? { badge: { label: t("chatsUnread", { n: room.unread }), tone: "accent" as const } } : {}),
        ...(room.when === "" ? {} : { meta: room.when }),
        href: href(chatRoomHref(room.id)),
    })),
    isLoading: data.isChatsLoading,
    emptyTitle: t("chatsEmptyTitle"),
    emptyBody: t("chatsEmptyBody"),
    emptyIcon: "chat",
    more: { label: t("chatsOpen"), href: href(CONSOLE_ROUTES.chat) },
})

/** The customers whose latest input came today. */
const leadsOf = (data: StaffHomeData, t: Words, href: (path: string) => string): StaffHomeList => ({
    title: t("leadsTitle"),
    fact: factOf(data.leads.length),
    rows: data.leads.map((lead) => ({
        id: lead.id,
        title: lead.name,
        description: lead.summary,
        icon: "email" as const,
        badge: { label: lead.channelLabel, tone: "muted" as const },
        meta: lead.time,
        href: href(CONSOLE_ROUTES.inbox),
    })),
    isLoading: data.isLeadsLoading,
    emptyTitle: t("leadsEmptyTitle"),
    emptyBody: t("leadsEmptyBody"),
    emptyIcon: "email",
    more: { label: t("leadsOpen"), href: href(CONSOLE_ROUTES.inbox) },
})

/** Connects the home of a member of staff: what the queries the pages already use answer, in the reader's words, and the places its rows open. */
export const StaffHome = () => {
    const t = useTranslations("staffHome")
    const words: Words = (key, values) => t(key, values)
    const workspaceId = useWorkspaceId()
    const router = navigation.useRouter()
    const data = useStaffHome()
    const nav = useConsoleNav("staff")
    const href = (path: string): string => workspaceHref(workspaceId, path)
    const figures = [
        { id: "assigned", term: t("figAssigned"), value: data.assigned ?? 0 },
        { id: "needs", term: t("figNeeds"), value: data.needsYou ?? 0 },
        { id: "unread", term: t("figUnread"), value: data.unread ?? 0 },
        { id: "newToday", term: t("figNewToday"), value: data.newToday ?? 0 },
    ]
    const shortcuts: StaffHomeList = {
        title: t("shortcutsTitle"),
        fact: null,
        rows: nav.map((item) => ({
            id: item.id,
            title: item.label,
            ...(SHORTCUT_KEYS.has(item.id) ? { description: words(`shortcut_${item.id}`) } : {}),
            icon: item.icon,
            ...(item.badge > 0 ? { badge: { label: String(item.badge), tone: "accent" as const } } : {}),
            href: item.href,
        })),
        isLoading: false,
        emptyTitle: t("shortcutsEmptyTitle"),
        emptyBody: t("shortcutsEmptyBody"),
        emptyIcon: "apps",
        more: null,
    }
    return (
        <StaffHomeBase
            props={{
                title: t("title"),
                description: t("description"),
                figuresLabel: t("figuresLabel"),
                figures,
                isFiguresLoading: [data.assigned, data.needsYou, data.unread, data.newToday].some((count) => count === undefined),
                work: workOf(data, words, href),
                chats: chatsOf(data, words, href),
                leads: leadsOf(data, words, href),
                shortcuts,
            }}
            on={{ open: (target) => router.push(target) }}
        />
    )
}

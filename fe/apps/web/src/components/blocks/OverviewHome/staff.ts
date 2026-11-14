import type { StaffHomeList, StaffHomeRow } from "@/components/frames/StaffHomeRegions"
import type { StaffHomeData } from "@/hooks/staffHome"
import { AGENTS_ROUTE, CONSOLE_ROUTES, chatRoomHref } from "@/modules/routes"
import type { ConsoleNavItem } from "@/modules/types"

/** The words of the page: a key of the `staffHome` catalog and its values. */
export type StaffWords = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** The shortcuts a rail destination has a line for. */
const SHORTCUT_KEYS: ReadonlySet<string> = new Set(["chat", "brain", "modules"])

/** The count as a short fact after a title, or null when there is nothing to count. */
const factOf = (count: number): string | null => (count === 0 ? null : String(count))

/** What waits for the person: the work given to them. */
export const workOf = (data: StaffHomeData, t: StaffWords, href: (path: string) => string): StaffHomeList => {
    const rows: StaffHomeRow[] = []
    if ((data.assigned ?? 0) > 0)
        rows.push({
            id: "assigned",
            title: t("workAssigned", { n: data.assigned ?? 0 }),
            description: t("workAssignedBody"),
            icon: "review",
            href: href(AGENTS_ROUTE),
        })
    return {
        title: t("workTitle"),
        fact: factOf(rows.length),
        rows,
        isLoading: data.isWorkLoading,
        emptyTitle: t("workEmptyTitle"),
        emptyBody: t("workEmptyBody"),
        emptyIcon: "complete",
        more: null,
    }
}

/** The recent chats, the unread ones marked with their count. */
export const chatsOf = (data: StaffHomeData, t: StaffWords, href: (path: string) => string): StaffHomeList => ({
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

/** The pages a member of staff can open, from the rail's destinations, each with its line when it has one. */
export const shortcutsOf = (nav: ReadonlyArray<ConsoleNavItem>, t: StaffWords): StaffHomeList => ({
    title: t("shortcutsTitle"),
    fact: null,
    rows: nav.map((item) => ({
        id: item.id,
        title: item.label,
        ...(SHORTCUT_KEYS.has(item.id) ? { description: t(`shortcut_${item.id}`) } : {}),
        icon: item.icon,
        ...(item.badge > 0 ? { badge: { label: String(item.badge), tone: "accent" as const } } : {}),
        href: item.href,
    })),
    isLoading: false,
    emptyTitle: t("shortcutsEmptyTitle"),
    emptyBody: t("shortcutsEmptyBody"),
    emptyIcon: "apps",
    more: null,
})

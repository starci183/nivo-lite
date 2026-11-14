"use client"

import { useTranslations } from "next-intl"
import { useConsoleNav } from "@/hooks/console"
import { useMember } from "@/hooks/member"
import { useOverview, useOverviewPhone } from "@/hooks/overview"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { useStaffHome } from "@/hooks/staffHome"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { OverviewHomeBase } from "./component"
import { managerCopyOf } from "./copy"
import { chatsOf, shortcutsOf, workOf, type StaffWords } from "./staff"

/**
 * Connects the home of the workspace: the role of the member picks the shape (owners and managers read the business dashboard, staff
 * their own day) and only that shape's reads run; while the role is not yet known neither runs and the manager shape draws its
 * regions as skeletons.
 */
export const OverviewHome = () => {
    const t = useTranslations("overview")
    const s = useTranslations("staffHome")
    const words: StaffWords = (key, values) => s(key, values)
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const role = useMember()?.role
    const shape = role === "staff" ? "staff" : "manager"
    const overview = useOverview(role === "owner" || role === "manager")
    const isPhone = useOverviewPhone()
    const managerCopy = managerCopyOf(t, overview.range)
    const staff = useStaffHome(role === "staff")
    const nav = useConsoleNav("staff")
    const href = (path: string): string => workspaceHref(workspaceId, path)
    return (
        <OverviewHomeBase
            props={{
                shape,
                manager: {
                    copy: managerCopy,
                    period: overview.period,
                    periods: overview.periods,
                    slot: role === undefined ? loadingSlot() : overview.slot,
                    placeholder: overview.placeholder,
                    labels: slotLabels(t("emptyTitle")),
                    isPhone,
                    chatHref: href(CONSOLE_ROUTES.chat),
                    agentsHref: href(AGENTS_ROUTE),
                },
                staff: {
                    title: s("title"),
                    description: s("description"),
                    figuresLabel: s("figuresLabel"),
                    figures: [
                        { id: "assigned", term: s("figAssigned"), value: staff.assigned ?? 0 },
                        { id: "unread", term: s("figUnread"), value: staff.unread ?? 0 },
                    ],
                    isFiguresLoading: [staff.assigned, staff.unread].includes(undefined),
                    work: workOf(staff, words, href),
                    chats: chatsOf(staff, words, href),
                    shortcuts: shortcutsOf(nav, words),
                },
            }}
            on={{
                setPeriod: overview.setPeriod,
                exportReport: overview.exportReport,
                openHref: (target) => router.push(href(target)),
                open: (target) => router.push(target),
                openAgents: () => router.push(href(AGENTS_ROUTE)),
                retry: overview.refresh,
            }}
        />
    )
}

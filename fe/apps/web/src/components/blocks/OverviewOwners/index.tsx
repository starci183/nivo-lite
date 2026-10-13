"use client"

import { useTranslations } from "next-intl"
import type { BadgeTone } from "@starci/grammar/common"
import type { IconName } from "@/components/leaves/Icon"
import { useDraftFollowUp, useOverviewOwners } from "@/hooks/overview"
import { moduleGlyphOf } from "@/hooks/installations"
import { navigation } from "@/modules/i18n"
import { leadHref } from "@/modules/routes"
import { OverviewOwnersBase } from "./component"

const STATUS_TONES: Readonly<Record<string, BadgeTone>> = {
    open: "neutral",
    waiting_approval: "accent",
    done: "success",
}
const STATUS_ICONS: Readonly<Record<string, IconName>> = {
    open: "pending",
    waiting_approval: "review",
    done: "complete",
}

/** What the role line of an owner group reads. */
interface OwnerGroupRole {
    readonly kind: string
    readonly handle: string | null
}

/** The connected open work by owner: reads the dashboard through SWR and draws the owner sections. */
export const OverviewOwners = () => {
    const t = useTranslations("responsibilities")
    const router = navigation.useRouter()
    const data = useOverviewOwners()
    const { draft, isDrafting } = useDraftFollowUp()
    if (data === undefined) return null
    const roleTextOf = (group: OwnerGroupRole): string => {
        if (group.kind !== "agent") return t("ownerHuman")
        return group.handle === null ? t("ownerAgent") : t("ownerAgentHandle", { handle: group.handle })
    }
    return (
        <OverviewOwnersBase
            props={{
                title: data.title,
                description: data.verifiedLabel,
                listLabel: t("groupAria"),
                emptyMessage: data.emptyMessage,
                emptyDescription: data.emptyDescription,
                emptyActionLabel: data.emptyActionLabel,
                draftLabel: isDrafting ? t("drafting") : t("menuDraft"),
                isDrafting,
                groups: data.groups.map((group) => ({
                    key: group.key,
                    name: group.name,
                    roleText: roleTextOf(group),
                    countText: t(group.rows.length === 1 ? "countOne" : "countMany", { n: group.rows.length }),
                    ariaLabel: t("groupOwnedBy", { name: group.name }),
                    cardsLabel: t("groupCards", { name: group.name }),
                    glyph: group.kind === "agent" ? moduleGlyphOf(group.handle) : null,
                    module: group.handle ?? "chatbot",
                    rows: group.rows.map((row) => ({
                        id: row.id,
                        icon: STATUS_ICONS[row.status] ?? "pending",
                        isOverdue: row.isOverdue,
                        title: row.title,
                        statusLabel: row.statusLabel,
                        statusTone: STATUS_TONES[row.status] ?? "neutral",
                        customer: row.customer,
                        ownerText: `${t("owner")} ${row.ownerName}`,
                        dueText: row.dueLabel,
                        nextText: row.status === "done" ? null : t("next", { action: row.nextAction }),
                        openLabel: t("open"),
                        openHref: leadHref(row.leadId),
                        leadId: row.leadId,
                        canDraft: row.status === "open",
                    })),
                })),
            }}
            on={{ openEmptyAction: () => router.push(data.emptyHref), draft: (id) => void draft(id) }}
        />
    )
}

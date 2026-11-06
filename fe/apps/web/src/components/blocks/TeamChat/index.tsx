"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { chatGridOf, usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { useTeamChatState } from "@/hooks/teamChat"
import { TeamChatBase } from "./component"
import { surfaceOf } from "./surface"

/**
 * The team chat page: the viewer's rooms, the open thread with its cards, the composer, and the new-chat form. The address may name
 * the room to open (`room`) or an agent to talk to (`with`): its direct room opens, and the first message opens it when none exists.
 */
export const TeamChat = () => {
    const t = useTranslations("teamChat")
    const pane = usePaneCopy()
    const slotLabels = useSlotLabels()
    const phone = usePanePhone()
    const query = useSearchParams()
    const withAgentId = query.get("with")
    const chat = useTeamChatState({ kind: "page", initialRoomId: query.get("room"), withAgentId }, phone.showMain)
    const surface = surfaceOf({
        chat,
        t,
        pane,
        labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
        withAgent: withAgentId !== null,
        phone,
        grid: chatGridOf({ hasList: true, phone: phone.phone }),
    })
    return <TeamChatBase props={surface.props} on={surface.on} />
}

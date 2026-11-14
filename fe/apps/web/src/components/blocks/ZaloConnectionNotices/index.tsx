"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloHead } from "@/hooks/zaloConnection"
import { navigation } from "@/modules/i18n"
import { ZaloConnectionNoticesBase } from "./component"

/** The connection of the url. */
interface ZaloConnectionNoticesProps {
    readonly connectionId: string
}

/** The connected notices of a Zalo OA page: why the OA cannot send, a refused command, (the first message it waits for is said by the setup card). */
export const ZaloConnectionNotices = (props: ZaloConnectionNoticesProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { head, notice, reconnect, isOwner } = useZaloHead(props.connectionId)
    const refusal = useConnectionRefusal()
    const headView = "items" in head ? head.items : undefined
    const banner = headView?.banner ?? ""
    const attention = headView?.attention ?? null
    return (
        <ZaloConnectionNoticesBase
            props={{
                head,
                slotLabels: slotLabels(t("headEmpty")),
                notices: [
                    ...(banner === "" ? [] : [{ id: "banner", tone: "negative" as const, title: banner }]),
                    // The provider refused the sign-in: the owner connects again (its own reconnect action); another member is told to ask.
                    ...(attention !== "needs_reauth" || banner !== ""
                        ? []
                        : [
                              {
                                  id: "needs-reauth",
                                  tone: "negative" as const,
                                  title: t(isOwner ? "bannerNeedsReauth" : "bannerNeedsReauthAsk"),
                                  ...(isOwner ? { action: { label: t("reconnect"), run: () => void reconnect() } } : {}),
                              },
                          ]),
                    // Connected, yet the provider cannot be read at the moment: neutral and informative, nothing to fix by hand.
                    ...(attention === "degraded"
                        ? [{ id: "degraded", tone: "informative" as const, title: t("degradedTitle"), description: t("degradedBody") }]
                        : []),
                    ...(notice === "" ? [] : [{ id: "notice", tone: "negative" as const, title: notice }]),
                ],
                ...(refusal === undefined ? {} : { refusal }),
            }}
            on={{ retry: () => router.refresh() }}
        />
    )
}

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
    const { head, notice } = useZaloHead(props.connectionId)
    const refusal = useConnectionRefusal()
    const banner = ("items" in head ? head.items : undefined)?.banner ?? ""
    return (
        <ZaloConnectionNoticesBase
            props={{
                head,
                slotLabels: slotLabels(t("headEmpty")),
                notices: [
                    ...(banner === "" ? [] : [{ id: "banner", tone: "negative" as const, title: banner }]),
                    ...(notice === "" ? [] : [{ id: "notice", tone: "negative" as const, title: notice }]),
                ],
                ...(refusal === undefined ? {} : { refusal }),
            }}
            on={{ retry: () => router.refresh() }}
        />
    )
}

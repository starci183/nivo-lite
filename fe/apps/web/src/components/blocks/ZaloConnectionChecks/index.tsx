"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloChecks, useZaloPage } from "@/hooks/zaloConnection"
import { ZaloConnectionChecksBase } from "./component"

/** What the page hands the check list: the connection of the url. */
interface ZaloConnectionChecksProps {
    readonly connectionId: string
}

/** The connected check list of a Zalo OA connection; "Check again" renews the token when it can and reads the verdicts again. */
export const ZaloConnectionChecks = (props: ZaloConnectionChecksProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { lines, recheck, isRechecking } = useZaloChecks(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    return (
        <ZaloConnectionChecksBase
            props={{
                title: t("checksTitle"),
                lines,
                slotLabels: slotLabels(t("checksEmpty")),
                markLabels: { ok: t("markOk"), fail: t("markFail"), warn: t("markWarn") },
                recheckLabel: t("recheck"),
                isRechecking,
            }}
            on={{ recheck: () => void recheck(), retry: reload }}
        />
    )
}

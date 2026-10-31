"use client"

import { useTranslations } from "next-intl"
import { useQueryZaloReturnSwr } from "@/hooks/connections"
import type { ZaloReturnInput } from "@/hooks/connections"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { ZaloReturnBase } from "./component"

/** What Zalo sends the browser back with. */
type ZaloReturnProps = ZaloReturnInput

/** Hands the Zalo return to the back end once, then lands the browser on the page it reconnected from, or on Connections with the verdict. */
export const ZaloReturn = (props: ZaloReturnProps) => {
    const t = useTranslations("connections")
    const slotLabelsOf = useSlotLabels()
    const read = useQueryZaloReturnSwr(props)
    return (
        <ZaloReturnBase
            props={{ waiting: t("zaloReturning"), landing: slotOfSwr(read), slotLabels: slotLabelsOf("") }}
            on={{
                retry: () => {
                    void read.mutate()
                },
            }}
        />
    )
}

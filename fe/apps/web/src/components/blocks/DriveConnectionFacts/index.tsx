"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveFacts, useDrivePage } from "@/hooks/drive"
import { useSlotLabels } from "@/hooks/slot"
import { DriveConnectionFactsBase } from "./component"

/** The connected details of the Google Drive account: the grant, the Google account, the documents read, the last read and the allowance. */
export const DriveConnectionFacts = () => {
    const t = useTranslations("driveConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const facts = useDriveFacts()
    const { reload } = useDrivePage()
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <DriveConnectionFactsBase
            props={{ title: tc("factsTitle"), facts, slotLabels: slotLabels(t("factsEmpty")) }}
            on={{ retry: reload }}
        />
    )
}

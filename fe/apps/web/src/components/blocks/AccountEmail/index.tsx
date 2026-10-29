"use client"

import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import { AccountEmailBase } from "./component"

/** The connected email card: shows the address the account signs in with (changing it is not built yet). */
export const AccountEmail = () => {
    const t = useTranslations("account")
    const slotLabels = useSlotLabels()
    const read = useQueryMyAccountSwr()

    return (
        <AccountEmailBase
            props={{
                title: t("emailTitle"),
                currentLabel: t("emailCurrent"),
                slot: mapSlot(slotOfSwr(read), (account) => account.email),
                labels: slotLabels(t("loadFailed")),
                hint: t("emailHint"),
            }}
            on={{ retry: () => void read.mutate() }}
        />
    )
}

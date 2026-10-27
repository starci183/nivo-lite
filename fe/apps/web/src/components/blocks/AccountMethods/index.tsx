"use client"

import { useTranslations } from "next-intl"
import { useAccountMethods } from "@/hooks/account"
import { useSlotLabels } from "@/hooks/slot"
import { AccountMethodsBase } from "./component"

/** The connected sign-in methods card: which methods the account has linked, read from the back end GraphQL API. */
export const AccountMethods = () => {
    const t = useTranslations("account")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useAccountMethods()
    return (
        <AccountMethodsBase
            props={{
                title: t("methodsTitle"),
                linkedLabel: t("methodLinked"),
                notLinkedLabel: t("methodNotLinked"),
                slot,
                placeholder: [
                    { id: "google", label: t("methodGoogle"), isLinked: false },
                    { id: "email", label: t("methodEmail"), isLinked: false },
                ],
                labels: slotLabels(t("loadFailed")),
            }}
            on={{ retry: reload }}
        />
    )
}

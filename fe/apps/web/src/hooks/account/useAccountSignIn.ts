"use client"

import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import type { AccountSignInView, DataSlot } from "@/modules/types"
import { METHOD_IDS } from "./account.shared"

/** The sign-in address of the account and which methods are linked, as a slot of the one account read, with the command that reads it again. */
export const useAccountSignIn = (): {
    readonly slot: DataSlot<AccountSignInView>
    readonly reload: () => void
} => {
    const t = useTranslations("account")
    const read = useQueryMyAccountSwr()
    return {
        slot: mapSlot(slotOfSwr(read), (account) => ({
            email: account.email,
            methods: METHOD_IDS.map((id) => ({
                id,
                label: id === "google" ? t("methodGoogle") : t("methodEmail"),
                isLinked: account.providers.includes(id),
            })),
        })),
        reload: () => void read.mutate(),
    }
}

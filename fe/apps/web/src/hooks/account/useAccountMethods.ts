"use client"

import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import type { DataSlot } from "@/modules/types"
import { METHOD_IDS } from "./account.shared"
import type { MethodView } from "./account.shared"

/** The sign-in methods of the account and whether each is linked, as a slot of the account read, with the command that reads it again. */
export const useAccountMethods = (): {
    readonly slot: DataSlot<ReadonlyArray<MethodView>>
    readonly reload: () => void
} => {
    const t = useTranslations("account")
    const read = useQueryMyAccountSwr()
    return {
        slot: mapSlot(slotOfSwr(read), (account) =>
            METHOD_IDS.map((id) => ({
                id,
                label: id === "google" ? t("methodGoogle") : t("methodEmail"),
                isLinked: account.providers.includes(id),
            })),
        ),
        reload: () => void read.mutate(),
    }
}

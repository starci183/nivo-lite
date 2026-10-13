"use client"

import { useTranslations } from "next-intl"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import { METHOD_IDS } from "./account.shared"
import type { MethodView } from "./account.shared"

/** The sign-in methods of the account and whether each is linked (every method reads as not linked while the account loads). */
export const useAccountMethods = (): { readonly methods: ReadonlyArray<MethodView>; readonly isLoading: boolean } => {
    const t = useTranslations("account")
    const { data, isLoading } = useQueryMyAccountSwr()
    return {
        isLoading,
        methods: METHOD_IDS.map((id) => ({
            id,
            label: id === "google" ? t("methodGoogle") : t("methodEmail"),
            isLinked: data?.providers.includes(id) ?? false,
        })),
    }
}

"use client"

import { useTranslations } from "next-intl"
import { useAccountMethods } from "@/hooks/account"
import { AccountMethodsBase } from "./component"

/** The connected sign-in methods card: which methods the account has linked, read from the back end GraphQL API. */
export const AccountMethods = () => {
    const t = useTranslations("account")
    const { methods, isLoading } = useAccountMethods()
    return (
        <AccountMethodsBase
            props={{
                title: t("methodsTitle"),
                linkedLabel: t("methodLinked"),
                notLinkedLabel: t("methodNotLinked"),
                methods,
                isLoading,
            }}
        />
    )
}

import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { accountHeadingOf } from "@/modules/page-header"
import { AccountPageBase } from "./component"

/** The document title of the page. */
export const accountMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("account")
    return { title: t("title") }
}

/** The /account screen body: static copy; the account, its sign-in methods and its device sessions are read in the browser from the back end GraphQL API. */
export const AccountPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("account")
    return (
        <AccountPageBase
            props={{
                header: accountHeadingOf({
                    title: t("title"),
                    description: t("description"),
                    tabsLabel: t("tabsLabel"),
                    profileLabel: t("tabProfile"),
                    accountLabel: t("tabAccount"),
                    selected: "account",
                }),
            }}
        />
    )
}

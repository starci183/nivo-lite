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

/** What the route hands the page: the workspace it is opened in. */
interface AccountPageProps {
    readonly workspaceId: string
}

/** The /account screen body: static copy; the account, its sign-in methods and its device sessions are read in the browser from the back end GraphQL API. */
export const AccountPage = async (props: AccountPageProps): Promise<ReactElement> => {
    const t = await getTranslations("account")
    const shell = await getTranslations("shell")
    return (
        <AccountPageBase
            props={{
                header: accountHeadingOf({
                    workspaceId: props.workspaceId,
                    crumbLabel: shell("crumbLabel"),
                    home: shell("crumbHome"),
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

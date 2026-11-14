import type { ReactElement } from "react"
import type { Metadata } from "next"
import type { PageHeaderContent } from "@starci/grammar/common"
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

/** The words of the header band, resolved on the server so the page and its loading state say the same; no workspace while loading. */
const accountHeader = async (workspaceId?: string): Promise<PageHeaderContent> => {
    const t = await getTranslations("account")
    const shell = await getTranslations("shell")
    return accountHeadingOf({
        workspaceId,
        crumbLabel: shell("crumbLabel"),
        home: shell("crumbHome"),
        title: t("title"),
        description: t("description"),
        tabsLabel: t("tabsLabel"),
        profileLabel: t("tabProfile"),
        accountLabel: t("tabAccount"),
        selected: "account",
    })
}

/** The /account screen body: static copy; the account, its sign-in methods and its device sessions are read in the browser from the back end GraphQL API. */
export const AccountPage = async (props: AccountPageProps): Promise<ReactElement> => (
    <AccountPageBase props={{ header: await accountHeader(props.workspaceId) }} />
)

/** The same page while the route loads: the real header and tabs, the two cards draw their own skeletons. */
export const AccountLoadingPage = async (): Promise<ReactElement> => (
    <AccountPageBase props={{ header: await accountHeader() }} />
)

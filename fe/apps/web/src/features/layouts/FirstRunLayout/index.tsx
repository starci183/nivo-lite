import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import { FirstRunLayoutBase } from "./component"

/** What the first-run route group hands the layout: the routed step. */
type FirstRunLayoutProps = { readonly children: ReactNode }

/** The frame of the first-run steps: the workspaces bar over the routed step. */
export const FirstRunLayout = async (props: FirstRunLayoutProps) => {
    const t = await getTranslations("onboarding")
    return <FirstRunLayoutBase props={{ mainLabel: t("pageTitle") }}>{props.children}</FirstRunLayoutBase>
}

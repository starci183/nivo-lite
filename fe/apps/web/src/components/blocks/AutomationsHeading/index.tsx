import { useTranslations } from "next-intl"
import { APP_ROUTES, CONSOLE_ROUTES } from "@/modules/routes"
import { AutomationsHeadingBase } from "./component"

/** Props of {@link AutomationsHeading}. */
interface AutomationsHeadingProps {
    /** The workspace name above the title; absent while the page loads. */
    readonly workspaceName?: string
}

/** The Automations page heading with the words of the automations catalog. */
export const AutomationsHeading = (props: AutomationsHeadingProps) => {
    const t = useTranslations("automations")
    return (
        <AutomationsHeadingBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "automations", label: t("title") },
                ],
                ...(props.workspaceName === undefined ? {} : { eyebrow: props.workspaceName }),
                title: t("title"),
                leadBefore: t("leadBefore"),
                leadLink: t("leadLink"),
                leadHref: CONSOLE_ROUTES.authority,
                leadAfter: t("leadAfter"),
            }}
        />
    )
}

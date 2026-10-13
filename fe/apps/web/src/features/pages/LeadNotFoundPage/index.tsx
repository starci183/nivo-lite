import { useTranslations } from "next-intl"
import { LEADS_ROUTES } from "@/modules/routes"
import { LeadNotFoundPageBase } from "./component"

/** Shown when the lead id does not exist. */
export const LeadNotFoundPage = () => {
    const t = useTranslations("leads")
    return (
        <LeadNotFoundPageBase
            props={{
                ariaLabel: t("notFoundAria"),
                title: t("notFoundTitle"),
                body: t("notFoundBody"),
                backLabel: t("notFoundBack"),
                backHref: LEADS_ROUTES.leads,
            }}
        />
    )
}

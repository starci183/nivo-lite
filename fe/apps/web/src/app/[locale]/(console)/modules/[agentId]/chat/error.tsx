"use client"

import { useTranslations } from "next-intl"
import { RouteError } from "@/components/blocks/RouteError"

/** STATE-8 case-4: an agent route whose data fails keeps its trail and the Modules heading, with one Alert and a retry. */
const AgentRouteError = ({ reset }: { readonly reset: () => void }) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    return (
        <RouteError
            crumbs={[
                { id: "home", label: ts("crumbHome"), href: "/dashboard" },
                { id: "modules", label: t("catalogTitle"), href: "/agents" },
            ]}
            title={t("catalogTitle")}
            onRetry={reset}
        />
    )
}

export default AgentRouteError

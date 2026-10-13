import { getTranslations } from "next-intl/server"
import { InboxPageBase } from "../InboxPage/component"

/** The same page while its data loads: the heading, notice, bank card and simulator, the feed as skeleton rows. */
export const InboxLoadingPage = async () => {
    const t = await getTranslations("inbox")
    return (
        <InboxPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: "/dashboard" },
                    { id: "inbox", label: t("title") },
                ],
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                alertTitle: t("simAlertTitle"),
                alertBody: t("simAlertBody"),
                bankTitle: t("bankTitle"),
                bankSimulated: t("bankSimulated"),
                bankNote: t("bankNote"),
                events: [],
                nowIso: "",
                initialEventId: "",
                isLoading: true,
            }}
        />
    )
}

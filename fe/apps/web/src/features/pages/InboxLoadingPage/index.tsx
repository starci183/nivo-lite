import { getTranslations } from "next-intl/server"
import { InboxFeed } from "@/components/blocks/InboxFeed"
import { InboxSimulator } from "@/components/blocks/InboxSimulator"
import { InboxPageLayout } from "@/components/composites/InboxPageLayout"
import { BANK_CONNECTION } from "@/hooks/banks"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The same page while its data loads: the heading, notice, bank card and simulator, the feed as skeleton rows. */
export const InboxLoadingPage = async () => {
    const t = await getTranslations("inbox")
    return (
        <InboxPageLayout
            crumbLabel={t("crumbLabel")}
            crumbs={[
                { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                { id: "inbox", label: t("title") },
            ]}
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
            alertTitle={t("simAlertTitle")}
            alertBody={t("simAlertBody")}
            bankTitle={t("bankTitle")}
            bankSimulated={t("bankSimulated")}
            bankNote={t("bankNote")}
            bankName={BANK_CONNECTION.name}
            bankAccount={BANK_CONNECTION.account}
            isLoading
            simulator={<InboxSimulator initialEventId="" />}
            feed={<InboxFeed isLoading />}
        />
    )
}

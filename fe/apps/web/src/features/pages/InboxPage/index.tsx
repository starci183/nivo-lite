import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InboxFeed } from "@/components/blocks/InboxFeed"
import { InboxSimulator } from "@/components/blocks/InboxSimulator"
import { InboxPageLayout } from "@/components/composites/InboxPageLayout"
import { BANK_CONNECTION } from "@/lib/bank"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The document title of the page. */
export const inboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("inbox")
    return { title: t("title") }
}

/** Server shell for the connected simulator and GraphQL inbox feed. */
export const InboxPage = async () => {
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
            isLoading={false}
            simulator={<InboxSimulator initialEventId={`sim-${crypto.randomUUID().slice(0, 8)}`} />}
            feed={<InboxFeed />}
        />
    )
}

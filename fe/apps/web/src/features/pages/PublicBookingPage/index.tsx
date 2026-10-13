import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { readPublicBookingPage } from "@/modules/db/booking/read-public-booking-page"
import { PublicBookingPageBase } from "./component"

/** What the route passes through: the slug in the URL. */
interface PublicBookingPageProps {
    readonly params: Promise<{ readonly slug: string }>
}

/** The document title: the page name with the shop when the slug has a page. */
export const publicBookingMetadata = async (props: PublicBookingPageProps): Promise<Metadata> => {
    const t = await getTranslations("workbenchBooking")
    const page = await readPublicBookingPage((await props.params).slug)
    return {
        title: page.kind === "ok" ? t("publicDocTitle", { shop: page.value.shop }) : t("publicTitle"),
        robots: { index: false },
    }
}

/** /b/<slug>: the public booking page, no login. Pick a service, a day and a time, leave a name and a phone. */
export const PublicBookingPage = async (props: PublicBookingPageProps) => {
    const t = await getTranslations("workbenchBooking")
    const page = await readPublicBookingPage((await props.params).slug)
    if (page.kind !== "ok") notFound()
    return <PublicBookingPageBase props={{ title: t("publicTitle"), page: page.value }} />
}

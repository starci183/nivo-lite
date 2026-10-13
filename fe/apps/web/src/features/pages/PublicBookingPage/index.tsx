import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { PublicBookingPageType } from "@/modules/api"
import { queryPublicBookingPage } from "@/modules/api/graphql/queries"
import type { PublicBookingPage as PublicBookingPageData } from "@/modules/types"
import { PublicBookingPageBase } from "./component"

/** What the route passes through: the slug in the URL. */
interface PublicBookingPageProps {
    readonly params: Promise<{ readonly slug: string }>
}

const pageOf = (data: PublicBookingPageType): PublicBookingPageData => ({
    shop: data.shop,
    slug: data.slug,
    note: data.note,
    address: data.address,
    timezone: data.timezone,
    services: data.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMin: service.durationMin,
        priceVnd: service.priceVnd ?? null,
    })),
})

/** The document title: the page name with the shop when the slug has a page. */
export const publicBookingMetadata = async (props: PublicBookingPageProps): Promise<Metadata> => {
    const t = await getTranslations("workbenchBooking")
    try {
        const result = await queryPublicBookingPage({ request: { slug: (await props.params).slug } })
        const page = result.data?.publicBookingPage
        return { title: page ? t("publicDocTitle", { shop: page.shop }) : t("publicTitle"), robots: { index: false } }
    } catch {
        return { title: t("publicTitle"), robots: { index: false } }
    }
}

/** /b/<slug>: the public booking page, no login. Pick a service, a day and a time, leave a name and a phone. */
export const PublicBookingPage = async (props: PublicBookingPageProps) => {
    const t = await getTranslations("workbenchBooking")
    let page
    try {
        const result = await queryPublicBookingPage({ request: { slug: (await props.params).slug } })
        page = result.data?.publicBookingPage
    } catch {
        notFound()
    }
    if (page === undefined || page === null) notFound()
    return <PublicBookingPageBase props={{ title: t("publicTitle"), page: pageOf(page) }} />
}

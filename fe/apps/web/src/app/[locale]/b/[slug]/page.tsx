import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Heading, PageContainer, Text } from "@starci/grammar/common"
import { CARD_STACK, PUBLIC_HEAD, PUBLIC_MAIN } from "@/app/classNames"
import { PublicBookingForm } from "@/features/module-booking/public-form"
import { loadPublicPage } from "@/lib/module-booking-public"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
    const page = await loadPublicPage((await params).slug)
    return { title: page ? `Đặt lịch hẹn · ${page.shop}` : "Đặt lịch hẹn", robots: { index: false } }
}

/** /b/<slug>: the public booking page (no login). Pick a service, a day and a time, leave a name and phone. */
const PublicBookingPage = async ({ params }: Props) => {
    const page = await loadPublicPage((await params).slug)
    if (!page) notFound()
    return (
        <main className={PUBLIC_MAIN}>
            <PageContainer measure="reading">
                <div className={CARD_STACK}>
                    <div className={PUBLIC_HEAD}>
                        <Heading level={1}>Đặt lịch hẹn</Heading>
                        <Text tone="muted">{page.shop}</Text>
                        {page.address ? (
                            <Text size="sm" tone="muted">
                                {page.address}
                            </Text>
                        ) : null}
                        {page.note ? <Text size="sm">{page.note}</Text> : null}
                    </div>
                    <PublicBookingForm
                        slug={page.slug}
                        services={page.services.map((s) => ({
                            id: s.id,
                            name: s.name,
                            description: s.description,
                            durationMin: s.duration_min,
                            priceVnd: s.price_vnd,
                        }))}
                        tz={page.tz}
                    />
                </div>
            </PageContainer>
        </main>
    )
}

export default PublicBookingPage

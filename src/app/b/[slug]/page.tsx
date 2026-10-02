import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBookingForm } from "@/features/module-booking/public-form";
import { loadPublicPage } from "@/lib/module-booking-public";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const page = await loadPublicPage((await params).slug);
  return { title: page ? `Đặt lịch hẹn · ${page.shop}` : "Đặt lịch hẹn", robots: { index: false } };
};

/** /b/<slug>: the public booking page (no login). Pick a service, a day and a time, leave a name and phone. */
const PublicBookingPage = async ({ params }: Props) => {
  const page = await loadPublicPage((await params).slug);
  if (!page) notFound();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6 md:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Đặt lịch hẹn</h1>
        <p className="text-muted">{page.shop}</p>
        {page.address ? <p className="text-sm text-muted">{page.address}</p> : null}
        {page.note ? <p className="text-sm">{page.note}</p> : null}
      </header>
      <PublicBookingForm slug={page.slug} services={page.services.map((s) => ({ id: s.id, name: s.name, description: s.description, durationMin: s.duration_min, priceVnd: s.price_vnd }))} tz={page.tz} />
    </main>
  );
};

export default PublicBookingPage;

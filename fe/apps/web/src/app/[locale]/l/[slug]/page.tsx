import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckForm } from "@/features/module-loyalty/public/CheckForm";
import { CANVAS_CLASS_NAME } from "@/features/module-loyalty/public/classNames";
import { programBySlug, shopNameOf } from "@/lib/module-loyalty-core";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = { readonly params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Điểm thân thiết", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public points check of one shop. Reachable without an account (the proxy lists /l as public); it shows nothing about anyone until the code sent to their own chat is typed. */
const PublicLoyaltyPage = async ({ params }: PageProps) => {
  const { slug } = await params;
  const db = supabaseAdmin();
  const program = await programBySlug(db, slug.toLowerCase()).catch(() => null);
  if (!program) notFound();
  const shop = program.name || (await shopNameOf(db, program.workspaceId));
  return (
    <main className={CANVAS_CLASS_NAME}>
      <CheckForm slug={program.slug} shop={shop} />
    </main>
  );
};

export default PublicLoyaltyPage;

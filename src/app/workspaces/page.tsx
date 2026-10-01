import { redirect } from "next/navigation";
import { Chrome } from "@/features/onboarding/Chrome";
import { WorkspacesHome, type WorkspaceCard } from "@/features/onboarding/WorkspacesHome";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { getLocale } from "@/i18n/server";
import { listPlans, myWorkspaces } from "@/lib/billing";
import { listMyInvites } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";

type WorkspacesPageProps = { readonly searchParams: Promise<{ reason?: string }> };

/** Home after sign-in: my workspaces, invitations waiting for me, and the way to create a new (paid) one. */
const WorkspacesPage = async ({ searchParams }: WorkspacesPageProps) => {
  const { reason } = await searchParams;
  const { data } = await (await supabaseServer()).auth.getUser();
  if (!data.user) redirect("/login");
  const [mine, plans, invites, locale] = await Promise.all([myWorkspaces(), listPlans(), listMyInvites(), getLocale()]);
  const day = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIME_ZONE });
  const planName = new Map(plans.map((p) => [p.code, locale === "vi" ? p.name_vi : p.name_en]));
  const now = Date.now();
  const workspaces: Array<WorkspaceCard> = mine.map((w) => ({
    id: w.id,
    name: w.name,
    role: w.role as WorkspaceCard["role"],
    planName: (w.plan_code && planName.get(w.plan_code)) || null,
    state: w.status === "pending_payment" ? "pending" : w.status === "cancelled" ? "cancelled" : w.status === "past_due" ? "past_due" : w.paid_until && new Date(w.paid_until).getTime() < now ? "expired" : "active",
    paidUntil: w.paid_until ? day.format(new Date(w.paid_until)) : null,
    canBill: w.role === "owner" || w.role === "manager",
  }));
  return (
    <Chrome>
      <WorkspacesHome workspaces={workspaces} invites={invites} email={data.user.email ?? ""} reason={reason === "disabled" || reason === "none" ? reason : undefined} />
    </Chrome>
  );
};

export default WorkspacesPage;

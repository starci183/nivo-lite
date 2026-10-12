import { redirect } from "next/navigation";
import { loadCredits } from "@/features/credits/queries";
import { CreditsView } from "@/features/credits/component";
import { getSession } from "@/lib/session";

/**
 * "Credit & gói": this month's credits, top-up packs, upgrade and payment history. A workspace that is not paid yet (waiting
 * for its first payment, or cancelled) keeps the plain billing page under /workspaces/<id>/billing.
 */
const BillingPage = async () => {
  const data = await loadCredits();
  if (data.workspaceStatus === "pending_payment" || data.workspaceStatus === "cancelled") redirect(`/workspaces/${(await getSession()).workspace.id}/billing`);
  return <CreditsView data={data} />;
};

export default BillingPage;

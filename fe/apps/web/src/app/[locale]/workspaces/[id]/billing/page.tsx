import { Billing } from "@/features/billing";
import { Chrome } from "@/features/onboarding/Chrome";

type BillingPageProps = { readonly params: Promise<{ id: string }> };

/** Plan, payments and renewal of one workspace (owner | manager). */
const BillingPage = async ({ params }: BillingPageProps) => {
  const { id } = await params;
  return (
    <Chrome>
      <Billing workspaceId={id} />
    </Chrome>
  );
};

export default BillingPage;

import { redirect } from "next/navigation";

type Props = { readonly searchParams: Promise<Record<string, string | undefined>> };

/** Old payment URL: forwards its query to /workspaces/new/payment. */
const OnboardingPaymentPage = async ({ searchParams }: Props) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (v) q.set(k, v);
  redirect(`/workspaces/new/payment${q.size ? `?${q.toString()}` : ""}`);
};

export default OnboardingPaymentPage;

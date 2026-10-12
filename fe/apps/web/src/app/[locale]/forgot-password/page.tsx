import { ForgotForm } from "@/features/auth/ForgotForm";

type ForgotPageProps = { readonly searchParams: Promise<{ email?: string }> };

/** Public "forgot password" page. */
const ForgotPasswordPage = async ({ searchParams }: ForgotPageProps) => {
  const { email } = await searchParams;
  return <ForgotForm initialEmail={email} loginHref="/login" />;
};

export default ForgotPasswordPage;

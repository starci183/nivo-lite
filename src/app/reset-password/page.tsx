import { ResetForm } from "@/features/auth/ResetForm";
import { supabaseServer } from "@/lib/supabase/server";

type ResetPageProps = { readonly searchParams: Promise<{ error?: string }> };

/** Set a new password. Reached through /auth/confirm (recovery), which leaves a session; without one the link is expired. */
const ResetPasswordPage = async ({ searchParams }: ResetPageProps) => {
  const { error } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return <ResetForm expired={Boolean(error) || !data.user} />;
};

export default ResetPasswordPage;

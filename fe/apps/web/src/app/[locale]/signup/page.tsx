import { redirect } from "next/navigation";
import { SignupForm } from "@/features/auth/SignupForm";
import { inviteNext } from "@/features/auth/next";
import { postAuthPath } from "@/features/auth/destination";
import { supabaseServer } from "@/lib/supabase/server";

type SignupPageProps = { readonly searchParams: Promise<{ invite?: string; email?: string }> };

/** Public sign-up page. `?invite=<token>` carries an invitation through (A2 accepts it at /invite/<token>). */
const SignupPage = async ({ searchParams }: SignupPageProps) => {
  const { invite, email } = await searchParams;
  const next = inviteNext(invite);
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(await postAuthPath(supabase, next));
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return <SignupForm next={next} invited={Boolean(next)} initialEmail={email} loginHref={loginHref} />;
};

export default SignupPage;

import { Login } from "@/features/login";
import { safeNext } from "@/features/auth/next";

type LoginPageProps = { readonly searchParams: Promise<{ error?: string; notice?: string; next?: string }> };

/** Public sign-in page. */
const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const { error, notice, next } = await searchParams;
  const safe = next ? safeNext(next) : undefined;
  return <Login showDemo={process.env.NEXT_PUBLIC_DEMO_LOGIN === "1"} errorCode={error} notice={notice} next={safe} />;
};

export default LoginPage;

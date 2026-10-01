import { Login } from "@/features/login";

type LoginPageProps = { readonly searchParams: Promise<{ error?: string }> };

/** Public sign-in page. */
const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const { error } = await searchParams;
  return <Login showDemo={process.env.NEXT_PUBLIC_DEMO_LOGIN === "1"} initialError={error} />;
};

export default LoginPage;

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "./lib/config";

const PUBLIC_PATHS = ["/login", "/auth", "/api/telegram", "/api/bank"]; // webhooks (Telegram, bank connection), each verified by its own secret header

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  // "/" is the public landing page; everything else in the console needs a session.
  const isPublic = request.nextUrl.pathname === "/" || PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Signed-in users who open the sign-in page go straight to their dashboard.
  if (data.user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};

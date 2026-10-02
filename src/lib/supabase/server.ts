import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicConfig } from "../config";
import { supabaseFetch } from "./perf";

export const supabaseServer = async () => {
  const store = await cookies();
  return createServerClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
};

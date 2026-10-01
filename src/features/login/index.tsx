"use client";

import { useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { signInDemo } from "./actions";
import { LoginBase } from "./component";

/** Props for {@link Login}. */
export type LoginProps = { readonly showDemo: boolean; readonly initialError?: string };

/** Connected sign-in card: Google OAuth in the browser, demo sign-in via server action. */
export const Login = ({ showDemo, initialError }: LoginProps) => {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isGooglePending, setGooglePending] = useState(false);
  const [isDemoPending, startDemo] = useTransition();
  return (
    <LoginBase
      props={{ showDemo, error, isGooglePending, isDemoPending }}
      on={{
        google: () => {
          setError(undefined);
          setGooglePending(true);
          void supabaseBrowser()
            .auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } })
            .then((result) => {
              if (result.error) {
                setError(result.error.message);
                setGooglePending(false);
              }
            });
        },
        demo: () => {
          setError(undefined);
          startDemo(async () => {
            const outcome = await signInDemo();
            if (!outcome.ok) setError(outcome.error);
          });
        },
      }}
    />
  );
};

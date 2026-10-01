"use client";

import { NivoGrammarRoot } from "@/ui";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

/** Props for {@link NivoGrammarTheme}: the routed stream the palette scopes. */
export type NivoGrammarThemeProps = { readonly children: ReactNode };

/** Keep the nivo palette on the resolved theme; stays "system" until after hydration. */
export const NivoGrammarTheme = ({ children }: NivoGrammarThemeProps) => {
  const { resolvedTheme } = useTheme();
  const [isHydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const theme = isHydrated && (resolvedTheme === "dark" || resolvedTheme === "light") ? resolvedTheme : "system";
  return <NivoGrammarRoot theme={theme}>{children}</NivoGrammarRoot>;
};

import type { ReactNode } from "react";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { SHELL_CLASS_NAME, TOP_CLASS_NAME } from "./classNames";

/** Page frame of the /workspaces area (outside the console shell): logo, language switch, content. */
export const Chrome = ({ children }: { readonly children: ReactNode }) => (
  <main className={SHELL_CLASS_NAME}>
    <div className={TOP_CLASS_NAME}>
      <a href="/workspaces" aria-label="NIVO">
        <NivoLogo variant="full" height={44} />
      </a>
      <LocaleSwitch />
    </div>
    {children}
  </main>
);

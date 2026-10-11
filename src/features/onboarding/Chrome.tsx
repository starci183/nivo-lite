import type { ReactNode } from "react";
import { Link, PageContainer } from "@starci/grammar/common";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { FRAME_CLASS_NAME, SHELL_CLASS_NAME, TOP_CLASS_NAME } from "./classNames";

/** Page frame of the /workspaces area (outside the console shell): logo, language switch, content inside the Grammar page inset. */
export const Chrome = ({ children }: { readonly children: ReactNode }) => (
  <main className={SHELL_CLASS_NAME}>
    <PageContainer measure="product">
      <div className={FRAME_CLASS_NAME}>
        <div className={TOP_CLASS_NAME}>
          <Link href="/workspaces" visited="uniform">
            <NivoLogo variant="full" height={44} />
          </Link>
          <LocaleSwitch />
        </div>
        {children}
      </div>
    </PageContainer>
  </main>
);

import type { ReactNode } from "react";
import { Button, PageContainer, Text } from "@starci/grammar/common";
import { BAR_CLASS, NAV_CLASS, PAGE_CLASS } from "./classNames";

export type ShellProps = { readonly email: string; readonly current: "workspaces" | "health"; readonly children: ReactNode };

/** Chrome of the team console: brand, the two areas, who is signed in. */
export const Shell = ({ email, current, children }: ShellProps) => (
  <>
    <header className={BAR_CLASS}>
      <nav className={NAV_CLASS} aria-label="NIVO team console">
        <Text weight="semibold">NIVO team console</Text>
        <Button size="sm" variant={current === "workspaces" ? "secondary" : "ghost"} href="/admin">Workspaces</Button>
        <Button size="sm" variant={current === "health" ? "secondary" : "ghost"} href="/admin/health">Platform health</Button>
      </nav>
      <Text size="sm" tone="muted">{email}</Text>
    </header>
    <PageContainer measure="full">
      <div className={PAGE_CLASS}>{children}</div>
    </PageContainer>
  </>
);

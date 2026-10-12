import type { ReactNode } from "react";
import { Button, NavLandmark, PageContainer, Text, TopBar } from "@starci/grammar/common";
import { PAGE_CLASS } from "./classNames";

export type ShellProps = { readonly email: string; readonly current: "workspaces" | "health"; readonly children: ReactNode };

/** Chrome of the team console through Grammar's TopBar: brand, the two areas, who is signed in. */
export const Shell = ({ email, current, children }: ShellProps) => (
  <>
    <TopBar
      position="static"
      brand={<Text weight="semibold">NIVO team console</Text>}
      navigation={
        <NavLandmark label="NIVO team console" layout="bar">
          <Button size="sm" variant={current === "workspaces" ? "secondary" : "ghost"} href="/admin">Workspaces</Button>
          <Button size="sm" variant={current === "health" ? "secondary" : "ghost"} href="/admin/health">Platform health</Button>
        </NavLandmark>
      }
      actions={<Text size="sm" tone="muted">{email}</Text>}
    />
    <PageContainer measure="full">
      <div className={PAGE_CLASS}>{children}</div>
    </PageContainer>
  </>
);

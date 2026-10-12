"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge, List, ListItem, Text, TextAction } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import { switchWorkspaceAction } from "./actions";
import { COPY_CLASS_NAME, SWITCH_CLASS_NAME } from "./classNames";

/** One workspace the person is an active member of. */
export type SwitcherWorkspace = { readonly id: string; readonly name: string; readonly role: "owner" | "manager" | "staff" };

/** Props for {@link WorkspaceSwitcher}. */
export type WorkspaceSwitcherProps = {
  readonly workspaces: ReadonlyArray<SwitcherWorkspace>;
  readonly currentId: string;
  /** Role labels from the caller's dictionary (e.g. access.roleOwner), so this stays translated. */
  readonly roleLabels: { readonly owner: string; readonly manager: string; readonly staff: string };
};

/**
 * Lists the person's workspaces (current one marked), switches with a cookie + reload, and ends with "Tạo workspace mới"
 * (-> /workspaces/new) and "Tất cả workspace" (-> /workspaces). Meant for the shell's user menu. Every entry is a Grammar
 * TextAction: a command for a switch (`appearance="choice"`, `isCurrent` on the current one), a destination for the two links.
 */
export const WorkspaceSwitcher = ({ workspaces, currentId, roleLabels }: WorkspaceSwitcherProps) => {
  const t = useT(onboarding);
  const router = useRouter();
  const [isPending, start] = useTransition();
  const pick = (id: string) => {
    if (id === currentId) return;
    start(async () => {
      await switchWorkspaceAction(id);
      router.push("/chat");
      router.refresh();
    });
  };
  return (
    <List className={SWITCH_CLASS_NAME} label={t("switchTitle")}>
      {workspaces.map((w) => (
        <ListItem key={w.id}>
          <TextAction
            appearance="choice"
            isCurrent={w.id === currentId}
            isDisabled={isPending}
            onPress={() => pick(w.id)}
            endContent={w.id === currentId ? <Badge tone="accent">{t("switchCurrent")}</Badge> : undefined}
          >
            <span className={COPY_CLASS_NAME}>
              <Text as="span" weight="medium">{w.name}</Text>
              <Text as="span" size="sm" tone="muted">{roleLabels[w.role]}</Text>
            </span>
          </TextAction>
        </ListItem>
      ))}
      <ListItem>
        <TextAction appearance="choice" href="/workspaces">{t("switchAll")}</TextAction>
      </ListItem>
      <ListItem>
        <TextAction appearance="choice" href="/workspaces/new">{t("switchNew")}</TextAction>
      </ListItem>
    </List>
  );
};

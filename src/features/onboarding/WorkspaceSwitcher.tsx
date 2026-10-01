"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import { switchWorkspaceAction } from "./actions";
import { SWITCH_CLASS_NAME, SWITCH_ITEM_CLASS_NAME } from "./classNames";

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
 * (-> /workspaces/new) and "Tất cả workspace" (-> /workspaces). Meant for the shell's user menu.
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
    <ul className={SWITCH_CLASS_NAME} aria-label={t("switchTitle")}>
      {workspaces.map((w) => (
        <li key={w.id}>
          <button type="button" className={SWITCH_ITEM_CLASS_NAME} disabled={isPending} aria-current={w.id === currentId ? "true" : undefined} onClick={() => pick(w.id)}>
            <span>
              <Text weight="medium">{w.name}</Text>
              <Text size="sm" tone="muted">{roleLabels[w.role]}</Text>
            </span>
            {w.id === currentId ? <Badge tone="accent">{t("switchCurrent")}</Badge> : null}
          </button>
        </li>
      ))}
      <li>
        <a className={SWITCH_ITEM_CLASS_NAME} href="/workspaces">
          <Text weight="medium">{t("switchAll")}</Text>
        </a>
      </li>
      <li>
        <a className={SWITCH_ITEM_CLASS_NAME} href="/workspaces/new">
          <Text weight="medium" tone="accent">{t("switchNew")}</Text>
        </a>
      </li>
    </ul>
  );
};

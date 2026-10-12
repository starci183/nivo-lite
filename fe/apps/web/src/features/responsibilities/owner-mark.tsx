"use client";

import { Text } from "@starci/grammar/common";
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar";
import { useT } from "@/i18n/client";
import { responsibilities } from "@/i18n/dict/responsibilities";
import { OWNER_MARK_CLASS_NAME, OWNER_TEXT_CLASS_NAME } from "./classNames";

/** What the owner mark draws. */
export type OwnerMarkProps = { kind: "human" | "agent"; name: string; handle: string | null };

/** The owner identity in a section header: an avatar for people, a module tile for agents, with name and role. */
export const OwnerMark = (props: OwnerMarkProps) => {
  const t = useT(responsibilities);
  return (
  <div className={OWNER_MARK_CLASS_NAME}>
    {props.kind === "agent" ? <AgentAvatar module={props.handle ?? undefined} label={props.name} size="md" /> : <PersonAvatar name={props.name} size="md" />}
    <div className={OWNER_TEXT_CLASS_NAME}>
      <Text weight="semibold" overflow="truncate">{props.name}</Text>
      <Text size="sm" tone="muted" overflow="truncate">
        {props.kind === "agent" ? (props.handle === null ? t("ownerAgent") : t("ownerAgentHandle", { handle: props.handle })) : t("ownerHuman")}
      </Text>
    </div>
  </div>  );
};

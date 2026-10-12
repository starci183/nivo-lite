"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, DropdownMenu, SurfaceCard, Text } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { updateAgent } from "@/lib/actions";
import { useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";
import type { AgentStats } from "@/features/modules/queries";
import {
  ACTIONS_CLASS_NAME, AGENT_TOP_CLASS_NAME, CARD_STACK_CLASS_NAME, HEADER_COPY_CLASS_NAME, TITLE_ROW_CLASS_NAME,
} from "@/features/modules/classNames";

type AgentCardProps = { readonly stats: AgentStats };

/** One installed agent: identity, real counts and the actions that work on it. */
export const AgentCard = ({ stats }: AgentCardProps) => {
  const { agent } = stats;
  const t = useT(modules);
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const isActive = agent.status === "active";
  const isChatbot = agent.module === "chatbot";

  const onToggle = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await updateAgent(agent.id, { status: isActive ? "paused" : "active" });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  };

  const onCopy = () => {
    navigator.clipboard.writeText(`@${agent.handle}`).catch(() => setError(t("copyFailed")));
  };

  return (
    <SurfaceCard ariaLabel={agent.name}>
      <div className={CARD_STACK_CLASS_NAME}>
        <div className={AGENT_TOP_CLASS_NAME}>
          <AgentAvatar module={agent.module} size="lg" label={agent.name} online={isActive} />
          <div className={HEADER_COPY_CLASS_NAME}>
            <div className={TITLE_ROW_CLASS_NAME}>
              <Text weight="semibold">{agent.name}</Text>
              <Badge isDot tone={isActive ? "success" : "neutral"}>{isActive ? t("statusActive") : t("statusPaused")}</Badge>
            </div>
            <Text size="sm" tone="muted">{`@${agent.handle} · ${agent.role}`}</Text>
          </div>
          <div className={ACTIONS_CLASS_NAME}>
            <Button variant="secondary" href={`/modules/${agent.id}/chat`}>{t("chat")}</Button>
            <Button variant="ghost" href={`/modules/${agent.id}`}>{t("setUp")}</Button>
            <DropdownMenu
              placement="bottom end"
              trigger={<Button variant="ghost" isPending={isPending}>{t("moreMenu")}</Button>}
              entries={[
                { id: "toggle", label: isActive ? t("pauseAgent") : t("resumeAgent"), description: isActive ? t("pauseHelp") : t("resumeHelp"), onAction: onToggle },
                ...(isChatbot ? [{ id: "customer", label: t("testAsCustomer"), href: `/modules/${agent.id}/chat?tab=customer` }] : []),
                { id: "office", label: t("mentionInOffice"), description: t("mentionHelp", { handle: agent.handle }), href: "/chat" },
                { id: "copy", label: t("copyMention"), onAction: onCopy },
              ]}
            />
          </div>
        </div>
        <Text size="sm" tone="muted">
          {isChatbot
            ? t("statsLineLeads", { conversations: stats.conversations, leads: stats.leadsCaptured, open: stats.openResponsibilities })
            : t("statsLine", { conversations: stats.conversations, open: stats.openResponsibilities })}
        </Text>
        {error !== undefined ? <Alert title={t("agentNotChanged")} description={error} tone="negative" /> : null}
      </div>
    </SurfaceCard>
  );
};

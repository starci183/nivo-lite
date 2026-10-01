"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, EmptyNotice, Heading, Switch, SurfaceCard, SurfaceListCard, Tabs, Text } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { updateAgent } from "@/lib/actions";
import { useLocale, useT } from "@/i18n/client";
import { common } from "@/i18n/dict/common";
import { modules } from "@/i18n/dict/modules";
import { formatStamp, moduleLabel } from "@/features/modules/format";
import type { AgentConversationRow } from "@/features/modules/queries";
import type { Agent } from "@/lib/types";
import { AgentSetupForm, type AgentSetupValues } from "../AgentSetupForm";
import {
  ACTIONS_CLASS_NAME, AGENT_TOP_CLASS_NAME, CONVERSATION_ROW_CLASS_NAME, HEADER_COPY_CLASS_NAME, PAGE_STACK_CLASS_NAME, ROW_COPY_CLASS_NAME, TITLE_ROW_CLASS_NAME,
} from "../classNames";

type AgentSettingsScreenProps = { agent: Agent; conversations: ReadonlyArray<AgentConversationRow> };

/** Edit an installed agent: header with the Active switch, then Setup and Conversations tabs. */
export const AgentSettingsScreen = ({ agent, conversations }: AgentSettingsScreenProps) => {
  const router = useRouter();
  const t = useT(modules);
  const tc = useT(common);
  const locale = useLocale();
  const [tab, setTab] = useState<"setup" | "conversations">("setup");
  const [values, setValues] = useState<AgentSetupValues>({
    name: agent.name, handle: agent.handle, role: agent.role, instructions: agent.instructions,
    knowledge: agent.knowledge, greeting: agent.greeting, approval_rule: agent.approval_rule,
  });
  const [isActive, setIsActive] = useState(agent.status === "active");
  const [error, setError] = useState<string | undefined>();
  const [statusError, setStatusError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isSaving, startSave] = useTransition();
  const [isSwitching, startSwitch] = useTransition();

  const onSave = () => {
    setError(undefined);
    setNotice(undefined);
    startSave(async () => {
      const result = await updateAgent(agent.id, values);
      if (!result.ok) { setError(result.error); return; }
      setNotice(t("setupSaved"));
      router.refresh();
    });
  };

  const onStatus = (next: boolean) => {
    setStatusError(undefined);
    startSwitch(async () => {
      const result = await updateAgent(agent.id, { status: next ? "active" : "paused" });
      if (!result.ok) { setStatusError(result.error); return; }
      setIsActive(next);
      router.refresh();
    });
  };

  return (
    <div className={PAGE_STACK_CLASS_NAME}>
      <SurfaceCard ariaLabel={t("statusAria", { name: agent.name })}>
        <div className={PAGE_STACK_CLASS_NAME}>
          <div className={AGENT_TOP_CLASS_NAME}>
            <AgentAvatar module={agent.module} size="lg" label={agent.name} online={isActive} />
            <div className={HEADER_COPY_CLASS_NAME}>
              <div className={TITLE_ROW_CLASS_NAME}>
                <Heading level={1}>{agent.name}</Heading>
                <Badge isDot tone={isActive ? "success" : "neutral"}>{isActive ? t("statusActive") : t("statusPaused")}</Badge>
                <Badge tone="neutral">{t("moduleWord", { module: moduleLabel(agent.module) })}</Badge>
              </div>
              <Text size="sm" tone="muted">{`@${agent.handle} · ${agent.role}`}</Text>
            </div>
            <div className={ACTIONS_CLASS_NAME}>
              <Switch name="status" label={isActive ? t("statusActive") : t("statusPaused")} isSelected={isActive} isDisabled={isSwitching} onSelectedChange={onStatus} />
              <Button variant="outline" href={`/modules/${agent.id}/chat`}>{t("openChat")}</Button>
              {agent.module === "chatbot" ? <Button variant="outline" href={`/modules/${agent.id}/chat?tab=customer`}>{t("testAsCustomer")}</Button> : null}
            </div>
          </div>
          {statusError !== undefined ? <Alert title={t("statusNotChanged")} description={statusError} tone="negative" /> : null}
        </div>
      </SurfaceCard>
      <Tabs
        label={t("tabsLabel")}
        selectedKey={tab}
        items={[{ id: "setup", label: t("tabSetup") }, { id: "conversations", label: t("tabConversations", { count: conversations.length }) }]}
        onSelect={(key) => setTab(key === "conversations" ? "conversations" : "setup")}
        inset="none"
        labelVisibility="always"
      />
      {tab === "setup" ? (
        <AgentSetupForm
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          onSubmit={onSave}
          submitLabel={t("saveSetup")}
          isPending={isSaving}
          error={error}
          notice={notice}
        />
      ) : (
        <SurfaceListCard
          label={t("conversationsTitle")}
          fact={t("conversationsTotal", { count: conversations.length })}
          empty={<EmptyNotice message={t("emptyTitle")} description={t("emptyHelp")} actionLabel={t("openChat")} onAction={() => router.push(`/modules/${agent.id}/chat`)} />}
        >
          {conversations.length === 0 ? null : conversations.map((item) => (
            <li key={item.id} className={CONVERSATION_ROW_CLASS_NAME}>
              <div className={ROW_COPY_CLASS_NAME}>
                <div className={TITLE_ROW_CLASS_NAME}>
                  <Text weight="semibold">{item.kind === "customer" ? (item.visitorName ?? t("websiteVisitor")) : t("testConversation")}</Text>
                  <Badge tone="neutral">{item.kind === "customer" ? t("kindCustomer") : t("kindTest")}</Badge>
                </div>
                <Text size="sm" tone="muted">{formatStamp(item.createdAt, locale)}</Text>
              </div>
              <div className={ACTIONS_CLASS_NAME}>
                {item.leadId !== null ? <Button variant="ghost" size="sm" href={`/leads/${item.leadId}`}>{item.leadName !== null ? t("leadLink", { name: item.leadName }) : t("openLead")}</Button> : null}
                <Button variant="outline" size="sm" href={`/modules/${agent.id}/chat?tab=${item.kind}&c=${item.id}`}>{tc("open")}</Button>
              </div>
            </li>
          ))}
        </SurfaceListCard>
      )}
    </div>
  );
};

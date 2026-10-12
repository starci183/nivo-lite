"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { nivoIconSource } from "@/components/leaves/Icon"
import { Avatar, Badge, Breadcrumbs, Button, DropdownMenu, IconButton, SectionHeader, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { leads } from "@/i18n/dict/leads";
import { draftExecution, refreshContext, suggestResponsibility } from "@/lib/actions";
import {
  ACTIONS_CLASS_NAME,
  HEADER_CLASS_NAME,
  IDENTITY_BODY_CLASS_NAME,
  IDENTITY_CLASS_NAME,
  TITLE_INLINE_CLASS_NAME,
} from "./classNames";
import type { PrimaryAction } from "./journey";

type LeadHeaderProps = {
  readonly leadId: string;
  readonly name: string;
  readonly meta: string;
  readonly stageLabel: string;
  readonly stageTone: "neutral" | "accent" | "warning" | "success" | "danger";
  readonly primary: PrimaryAction;
  /** STATE-8: the trail stays real, the name, the facts line and the avatar are skeletons and the actions are not drawn. */
  readonly isLoading?: boolean;
};

/** Lead page header: path back, eyebrow + name + stage, action bar and the journey stepper. */
export const LeadHeader = ({ leadId, name, meta, stageLabel, stageTone, primary, isLoading = false }: LeadHeaderProps) => {
  const router = useRouter();
  const t = useT(leads);
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) => {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (done !== undefined) setNotice(done);
        router.refresh();
      } else {
        setNotice(result.error);
      }
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/leads/${leadId}`);
      setNotice(t("noticeCopied"));
    } catch {
      setNotice(t("noticeCopyFail"));
    }
  };

  const trail = (
    <Breadcrumbs
      label={t("crumbLabel")}
      items={[
        { id: "home", label: t("crumbHome"), href: "/dashboard" },
        { id: "leads", label: t("title"), href: "/leads" },
        isLoading ? { id: "lead", label: "", isSkeleton: true as const } : { id: "lead", label: name },
      ]}
    />
  );

  if (isLoading) {
    return (
      <div className={HEADER_CLASS_NAME}>
        {trail}
        <div className={IDENTITY_CLASS_NAME}>
          <Avatar name="" size="lg" isSkeleton />
          <div className={IDENTITY_BODY_CLASS_NAME}>
            <SectionHeader level={1} isSkeleton title="" description="" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={HEADER_CLASS_NAME}>
      {trail}
      <div className={IDENTITY_CLASS_NAME}>
        <PersonAvatar name={name} size="lg" />
        <div className={IDENTITY_BODY_CLASS_NAME}>
          <SectionHeader
            level={1}
            title={
              <span className={TITLE_INLINE_CLASS_NAME}>
                {name}
                <Badge tone={stageTone} isDot>{stageLabel}</Badge>
              </span>
            }
            description={meta}
            action={
              <div className={ACTIONS_CLASS_NAME}>
                {primary.kind === "review" ? <Button variant="secondary" href="#execution">{t("reviewApproval")}</Button> : null}
                {primary.kind === "draft" ? (
                  <Button variant="primary" isPending={isPending} onPress={() => run(() => draftExecution(primary.responsibilityId))}>{t("draftFollowUp")}</Button>
                ) : null}
                {primary.kind === "propose" ? (
                  <Button variant="primary" isPending={isPending} onPress={() => run(() => suggestResponsibility(leadId))}>{t("proposeOwner")}</Button>
                ) : null}
                <Button variant="outline" href="/chat">{t("openOffice")}</Button>
                <DropdownMenu
                  placement="bottom end"
                  entries={[
                    { id: "refresh", label: t("menuRefresh"), onAction: () => run(() => refreshContext(leadId), t("noticeRefreshed")) },
                    { id: "outcome", label: t("menuOutcome"), href: "#outcome" },
                    { id: "copy", label: t("menuCopy"), onAction: () => void onCopy() },
                  ]}
                  trigger={<IconButton source={nivoIconSource("more", "leading")} label={t("menuMore")} />}
                />
              </div>
            }
          />
        </div>
      </div>
      {notice === null ? null : <Text size="sm" tone="muted" live="polite">{notice}</Text>}
    </div>
  );
};

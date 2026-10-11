"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyNotice, Form, Heading, Image, Input, List, ListItem, MediaFrame, Region, SectionHeader, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import { acceptInviteForMe, type MyInvite } from "@/lib/onboarding";
import { openWorkspaceAction } from "./actions";
import { WorkspaceTile } from "./WorkspaceTile";
import {
  ACTIONS_CLASS_NAME, CENTERED_CLASS_NAME, CHIPS_CLASS_NAME, COPY_CLASS_NAME, GRID_CLASS_NAME, INVITE_ROW_CLASS_NAME, MASCOT_CLASS_NAME, STACK_CLASS_NAME,
  STACK_MD_CLASS_NAME, WS_CARD_CLASS_NAME, WS_GRID_CLASS_NAME, WS_HEAD_CLASS_NAME,
} from "./classNames";

/** One workspace card, already resolved on the server (plan name, state, whether billing is reachable). */
export type WorkspaceCard = {
  readonly id: string;
  readonly name: string;
  readonly role: "owner" | "manager" | "staff";
  readonly planName: string | null;
  readonly state: "active" | "pending" | "expired" | "past_due" | "cancelled";
  readonly paidUntil: string | null;
  readonly canBill: boolean;
};

/** Props for {@link WorkspacesHome}. */
export type WorkspacesHomeProps = {
  readonly workspaces: ReadonlyArray<WorkspaceCard>;
  readonly invites: ReadonlyArray<MyInvite>;
  readonly email: string;
  readonly reason?: "disabled" | "none";
};

const STATE_KEY = { active: "stateActive", pending: "statePending", expired: "stateExpired", past_due: "statePastDue", cancelled: "stateCancelled" } as const;
const STATE_TONE = { active: "success", pending: "warning", expired: "danger", past_due: "danger", cancelled: "neutral" } as const;
const ROLE_KEY = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const;

const inviteToken = (text: string): string | null => {
  const m = text.trim().match(/\/invite\/([^/?#\s]+)/);
  return m ? m[1] : /^[A-Za-z0-9_-]{16,}$/.test(text.trim()) ? text.trim() : null;
};

/** One workspace: a top-level SurfaceCard in the collection grid. */
const Card = ({ w }: { readonly w: WorkspaceCard }) => {
  const t = useT(onboarding);
  const [isPending, start] = useTransition();
  const needsPayment = w.state === "pending" || w.state === "cancelled";
  // Managers and staff cannot pay for a workspace that is not active yet: nothing to open.
  const blocked = needsPayment && w.role !== "owner";
  const meta = [w.planName, w.paidUntil ? t("paidUntil", { date: w.paidUntil }) : null].filter(Boolean).join(" · ");
  return (
    <SurfaceCard ariaLabel={w.name} height="fill">
      <div className={WS_CARD_CLASS_NAME}>
        <div className={WS_HEAD_CLASS_NAME}>
          <WorkspaceTile name={w.name} />
          <div className={COPY_CLASS_NAME}>
            <Heading level={2}>{w.name}</Heading>
            <Text size="sm" tone="muted">{meta || t(ROLE_KEY[w.role])}</Text>
          </div>
        </div>
        <div className={CHIPS_CLASS_NAME}>
          <Badge tone={STATE_TONE[w.state]} isDot>{t(STATE_KEY[w.state])}</Badge>
          <Badge tone="neutral">{t(ROLE_KEY[w.role])}</Badge>
        </div>
        <div className={ACTIONS_CLASS_NAME}>
          <Button variant={needsPayment ? "primary" : "secondary"} isDisabled={blocked} isPending={isPending} onPress={() => start(async () => { await openWorkspaceAction(w.id); })}>
            {needsPayment ? t("payNow") : t("open")}
          </Button>
          {w.canBill && !needsPayment ? <Button variant="ghost" href={`/workspaces/${w.id}/billing`}>{t("billingLink")}</Button> : null}
        </div>
      </div>
    </SurfaceCard>
  );
};

/** /workspaces: every workspace the person belongs to, invitations waiting for them, and the way to open a new one. */
export const WorkspacesHome = ({ workspaces, invites, email, reason }: WorkspacesHomeProps) => {
  const t = useT(onboarding);
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const join = (id: string) => {
    setError(null);
    setBusy(id);
    start(async () => {
      const res = await acceptInviteForMe(id);
      if (res.ok) {
        router.push("/chat");
        router.refresh();
      } else {
        setError(res.error);
        setBusy(null);
      }
    });
  };
  const openLink = () => {
    const token = inviteToken(link);
    if (!token) return setError(t("errLink"));
    router.push(`/invite/${token}`);
  };

  return (
    <div className={STACK_CLASS_NAME}>
      <SectionHeader
        level={1}
        title={t("workspacesTitle")}
        description={t("workspacesText")}
        action={workspaces.length ? <Button variant="primary" size="lg" href="/workspaces/new">{t("createNew")}</Button> : undefined}
      />
      {reason ? <Alert tone="cautionary" title={reason === "disabled" ? t("reasonDisabled") : t("reasonNone")} /> : null}

      {workspaces.length ? (
        <List className={WS_GRID_CLASS_NAME} label={t("myWorkspaces")}>
          {workspaces.map((w) => (
            <ListItem key={w.id}>
              <Card w={w} />
            </ListItem>
          ))}
        </List>
      ) : (
        <SurfaceCard ariaLabel={t("emptyTitle")}>
          <div className={CENTERED_CLASS_NAME}>
            <div className={MASCOT_CLASS_NAME}>
              <MediaFrame treatment="plain" aspect="portrait" fit="contain">
                <Image src="/images/promo/mascot-checklist.png" alt="" aspect="portrait" fit="contain" plate="none" />
              </MediaFrame>
            </div>
            <EmptyNotice message={t("emptyTitle")} description={t("emptyText")} />
            <Button variant="primary" size="lg" href="/workspaces/new">{t("createNew")}</Button>
          </div>
        </SurfaceCard>
      )}

      <div className={GRID_CLASS_NAME}>
        <Region labelledBy="ws-invites" className={STACK_MD_CLASS_NAME}>
          <SectionHeader id="ws-invites" level={2} title={t("pendingInvites")} description={t("pathJoinText", { email })} />
          <SurfaceListCard ariaLabel={t("pendingInvites")} empty={<EmptyNotice message={t("noInvites", { email })} />}>
            {invites.map((i) => (
              <ListItem key={i.id} className={INVITE_ROW_CLASS_NAME}>
                <div className={WS_HEAD_CLASS_NAME}>
                  <WorkspaceTile name={i.workspaceName || "?"} size="md" />
                  <div className={COPY_CLASS_NAME}>
                    <Text weight="semibold" overflow="truncate">{i.workspaceName}</Text>
                    <Text size="sm" tone="muted">{[t("inviteRole", { role: i.role === "manager" ? t("roleManager") : t("roleStaff") }), i.invitedBy ? t("inviteBy", { name: i.invitedBy }) : null].filter(Boolean).join(" · ")}</Text>
                  </div>
                </div>
                <div className={ACTIONS_CLASS_NAME}>
                  <Button variant="secondary" isPending={isPending && busy === i.id} isDisabled={isPending} onPress={() => join(i.id)}>{t("join")}</Button>
                </div>
              </ListItem>
            ))}
          </SurfaceListCard>
        </Region>
        <Region labelledBy="ws-link-title" className={STACK_MD_CLASS_NAME}>
          <SectionHeader id="ws-link-title" level={2} title={t("haveLink")} description={t("haveLinkText")} />
          <SurfaceCard ariaLabel={t("haveLink")}>
            <Form label={t("haveLink")} onSubmit={openLink}>
              <div className={STACK_MD_CLASS_NAME}>
                <Input id="ws-link" name="link" label={t("haveLink")} placeholder={t("linkPlaceholder")} variant="secondary" value={link} onValueChange={setLink} />
                {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
                <div className={ACTIONS_CLASS_NAME}>
                  <Button type="submit" variant="outline" isDisabled={!link.trim()}>{t("openLink")}</Button>
                </div>
              </div>
            </Form>
          </SurfaceCard>
        </Region>
      </div>
    </div>
  );
};

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, Form, Input } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import { acceptInviteForMe, type MyInvite } from "@/lib/onboarding";
import { openWorkspaceAction } from "./actions";
import { WorkspaceTile } from "./WorkspaceTile";
import {
  ACTIONS_CLASS_NAME, CARD_CLASS_NAME, CHIPS_CLASS_NAME, EMPTY_CLASS_NAME, EMPTY_IMG_CLASS_NAME, GRID_CLASS_NAME, H1_CLASS_NAME, INVITE_CLASS_NAME,
  LIST_CLASS_NAME, MUTED_CLASS_NAME, SECTION_TITLE_CLASS_NAME, STACK_CLASS_NAME, STACK_SM_CLASS_NAME, TOP_ROW_CLASS_NAME, WS_CARD_CLASS_NAME,
  WS_GRID_CLASS_NAME, WS_HEAD_CLASS_NAME, WS_META_CLASS_NAME, WS_NAME_CLASS_NAME,
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

const Card = ({ w }: { readonly w: WorkspaceCard }) => {
  const t = useT(onboarding);
  const [isPending, start] = useTransition();
  const needsPayment = w.state === "pending" || w.state === "cancelled";
  // Managers and staff cannot pay for a workspace that is not active yet: nothing to open.
  const blocked = needsPayment && w.role !== "owner";
  const meta = [w.planName, w.paidUntil ? t("paidUntil", { date: w.paidUntil }) : null].filter(Boolean).join(" · ");
  return (
    <li className={WS_CARD_CLASS_NAME}>
      <div className={WS_HEAD_CLASS_NAME}>
        <WorkspaceTile name={w.name} />
        <div className="min-w-0 flex-1">
          <h3 className={WS_NAME_CLASS_NAME}>{w.name}</h3>
          <p className={WS_META_CLASS_NAME}>{meta || t(ROLE_KEY[w.role])}</p>
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
    </li>
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
    <div>
      <div className={STACK_CLASS_NAME}>
        <div className={TOP_ROW_CLASS_NAME}>
          <div className={STACK_SM_CLASS_NAME}>
            <h1 className={H1_CLASS_NAME}>{t("workspacesTitle")}</h1>
            <p className={MUTED_CLASS_NAME}>{t("workspacesText")}</p>
          </div>
          {workspaces.length ? <Button variant="primary" size="lg" href="/workspaces/new">{t("createNew")}</Button> : null}
        </div>
        {reason ? <Alert tone="cautionary" title={reason === "disabled" ? t("reasonDisabled") : t("reasonNone")} /> : null}

        {workspaces.length ? (
          <ul className={`${LIST_CLASS_NAME} ${WS_GRID_CLASS_NAME}`} aria-label={t("myWorkspaces")}>
            {workspaces.map((w) => <Card key={w.id} w={w} />)}
          </ul>
        ) : (
          <div className={EMPTY_CLASS_NAME}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={EMPTY_IMG_CLASS_NAME} src="/images/promo/mascot-checklist.png" alt="" />
            <div className={STACK_SM_CLASS_NAME}>
              <h2 className={SECTION_TITLE_CLASS_NAME}>{t("emptyTitle")}</h2>
              <p className={MUTED_CLASS_NAME}>{t("emptyText")}</p>
            </div>
            <Button variant="primary" size="lg" href="/workspaces/new">{t("createNew")}</Button>
          </div>
        )}

        <div className={GRID_CLASS_NAME}>
          <section className={CARD_CLASS_NAME} aria-labelledby="ws-invites">
            <div className={STACK_CLASS_NAME}>
              <div className={STACK_SM_CLASS_NAME}>
                <h2 id="ws-invites" className={SECTION_TITLE_CLASS_NAME}>{t("pendingInvites")}</h2>
                <p className={MUTED_CLASS_NAME}>{t("pathJoinText", { email })}</p>
              </div>
              {invites.length ? (
                <ul className={LIST_CLASS_NAME}>
                  {invites.map((i) => (
                    <li key={i.id} className={INVITE_CLASS_NAME}>
                      <div className={WS_HEAD_CLASS_NAME}>
                        <WorkspaceTile name={i.workspaceName || "?"} size={44} />
                        <div className="min-w-0 flex-1">
                          <h3 className={WS_NAME_CLASS_NAME}>{i.workspaceName}</h3>
                          <p className={WS_META_CLASS_NAME}>{[t("inviteRole", { role: i.role === "manager" ? t("roleManager") : t("roleStaff") }), i.invitedBy ? t("inviteBy", { name: i.invitedBy }) : null].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                      <div className={ACTIONS_CLASS_NAME}>
                        <Button variant="secondary" isPending={isPending && busy === i.id} isDisabled={isPending} onPress={() => join(i.id)}>{t("join")}</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={MUTED_CLASS_NAME}>{t("noInvites", { email })}</p>
              )}
            </div>
          </section>
          <section className={CARD_CLASS_NAME} aria-labelledby="ws-link-title">
            <Form label={t("haveLink")} onSubmit={openLink}>
              <div className={STACK_CLASS_NAME}>
                <div className={STACK_SM_CLASS_NAME}>
                  <h2 id="ws-link-title" className={SECTION_TITLE_CLASS_NAME}>{t("haveLink")}</h2>
                  <p className={MUTED_CLASS_NAME}>{t("haveLinkText")}</p>
                </div>
                <Input id="ws-link" name="link" label={t("haveLink")} placeholder={t("linkPlaceholder")} variant="secondary" value={link} onValueChange={setLink} />
                {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
                <div className={ACTIONS_CLASS_NAME}>
                  <Button type="submit" variant="outline" isDisabled={!link.trim()}>{t("openLink")}</Button>
                </div>
              </div>
            </Form>
          </section>
        </div>
      </div>
    </div>
  );
};

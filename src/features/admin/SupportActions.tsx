"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Select, SurfaceCard, Text } from "@starci/grammar/common";
import type { Outcome } from "@/lib/types";
import { extendSubscription, resendWorkspaceInvite, setWorkspacePlan, setWorkspaceStatus } from "./actions";
import { ACTION_CLASS, ACTION_ROW_CLASS, CONFIRM_CLASS, STACK_CLASS } from "./classNames";

export type SupportActionsProps = {
  readonly workspaceId: string;
  readonly status: string;
  readonly planCode: string | null;
  /** The workspace's own monthly credit allowance (null: the plan's). */
  readonly creditsLimit: number | null;
  readonly invites: ReadonlyArray<{ id: string; email: string }>;
};

type Pending =
  | { kind: "extend"; days: number }
  | { kind: "status"; to: "active" | "past_due" }
  | { kind: "invite"; id: string; email: string }
  | { kind: "plan"; code: string; credits: number | null };

/** Plans a workspace can be moved to (the server re-checks that the plan exists and is active). */
const PLAN_OPTIONS = [
  { id: "starter", label: "Starter · 1,150 credits" },
  { id: "pro", label: "Pro · 5,765 credits" },
  { id: "max", label: "Max · 19,227 credits" },
  { id: "enterprise", label: "Enterprise · by contract" },
];

/** Support actions. Each one asks for a confirmation in the page first; the server re-checks the admin and writes platform_audit. */
export const SupportActions = ({ workspaceId, status, planCode, creditsLimit, invites }: SupportActionsProps) => {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [days, setDays] = useState("30");
  const [plan, setPlan] = useState<string | null>(planCode);
  const [credits, setCredits] = useState(creditsLimit === null ? "" : String(creditsLimit));
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ tone: "affirmative" | "negative"; text: string } | null>(null);

  const ask = (p: Pending) => { setMessage(null); setPending(p); };
  const done = <T,>(r: Outcome<T>, ok: string) => {
    setPending(null);
    setMessage(r.ok ? { tone: "affirmative", text: ok } : { tone: "negative", text: r.error });
    if (r.ok) router.refresh();
  };
  const run = () => {
    if (!pending) return;
    const p = pending;
    start(async () => {
      try {
        if (p.kind === "extend") done(await extendSubscription(workspaceId, p.days), `Extended by ${p.days} days.`);
        else if (p.kind === "status") done(await setWorkspaceStatus(workspaceId, p.to), `Marked ${p.to}.`);
        else if (p.kind === "plan") done(await setWorkspacePlan(workspaceId, p.code, p.credits), `Plan set to ${p.code}${p.credits === null ? "" : ` with ${p.credits} credits a month`}.`);
        else done(await resendWorkspaceInvite(workspaceId, p.id), `Invitation resent to ${p.email}.`);
      } catch (e) {
        done({ ok: false, error: e instanceof Error ? e.message : String(e) }, "");
      }
    });
  };
  const n = Number(days);
  const daysOk = Number.isInteger(n) && n >= 1 && n <= 366;
  const c = credits.trim() === "" ? null : Number(credits);
  const creditsOk = c === null || (Number.isInteger(c) && c >= 0 && c <= 100_000_000);
  const sentence = !pending ? "" : pending.kind === "extend" ? `Extend the subscription by ${pending.days} days?` : pending.kind === "status" ? `Mark this workspace ${pending.to}?` : pending.kind === "plan" ? `Move this workspace to ${pending.code}${pending.credits === null ? " with the plan's credits" : ` with its own ${pending.credits} credits a month`}?` : `Resend the invitation to ${pending.email}? The old link stops working.`;

  return (
    <SurfaceCard label="Support actions" ariaLabel="Support actions">
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">Manual, for support. Every action is confirmed here and logged in the audit trail. There is no impersonation.</Text>
        <div className={ACTION_CLASS}>
          <div className={ACTION_ROW_CLASS}>
            <Input id="extend-days" name="days" label="Extend subscription by (days)" value={days} onValueChange={setDays} isError={!daysOk} errorMessage={daysOk ? undefined : "1 to 366"} />
            <Button variant="secondary" isDisabled={!daysOk || isPending} onPress={() => ask({ kind: "extend", days: n })}>Extend</Button>
          </div>
          <div className={ACTION_ROW_CLASS}>
            <Button variant="secondary" isDisabled={status === "active" || isPending} onPress={() => ask({ kind: "status", to: "active" })}>Mark active</Button>
            <Button variant="danger-soft" isDisabled={status === "past_due" || isPending} onPress={() => ask({ kind: "status", to: "past_due" })}>Mark past due</Button>
          </div>
          <div className={ACTION_ROW_CLASS}>
            <Select label="Plan" options={PLAN_OPTIONS} value={plan} onValueChange={setPlan} />
            <Input id="admin-credits" name="credits" label="Own credits a month (blank: the plan's)" value={credits} onValueChange={setCredits} isError={!creditsOk} errorMessage={creditsOk ? undefined : "A whole number"} />
            <Button variant="secondary" isDisabled={!plan || !creditsOk || isPending} onPress={() => plan && ask({ kind: "plan", code: plan, credits: c })}>Set plan</Button>
          </div>
          {invites.length > 0 ? (
            <div className={ACTION_ROW_CLASS}>
              {invites.map((i) => <Button key={i.id} variant="outline" size="sm" isDisabled={isPending} onPress={() => ask({ kind: "invite", id: i.id, email: i.email })}>{`Resend invite: ${i.email}`}</Button>)}
            </div>
          ) : null}
        </div>
        {pending ? (
          <Alert tone="cautionary" title="Confirm" description={sentence} />
        ) : null}
        {pending ? (
          <div className={CONFIRM_CLASS}>
            <Button variant="primary" isPending={isPending} onPress={run}>Confirm</Button>
            <Button variant="ghost" isDisabled={isPending} onPress={() => setPending(null)}>Cancel</Button>
          </div>
        ) : null}
        {message ? <Alert tone={message.tone} title={message.tone === "affirmative" ? "Done" : "Could not do that"} description={message.text} /> : null}
      </div>
    </SurfaceCard>
  );
};

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDialog, Button, Input, SurfaceCard, Text } from "@starci/grammar/common";
import type { Outcome } from "@/lib/types";
import { extendSubscription, resendWorkspaceInvite, setWorkspaceStatus } from "./actions";
import { ACTION_CLASS, ACTION_ROW_CLASS, STACK_CLASS } from "./classNames";

export type SupportActionsProps = {
  readonly workspaceId: string;
  readonly status: string;
  readonly invites: ReadonlyArray<{ id: string; email: string }>;
};

type Pending =
  | { kind: "extend"; days: number }
  | { kind: "status"; to: "active" | "past_due" }
  | { kind: "invite"; id: string; email: string };

/** Support actions. Each one asks for a confirmation in an AlertDialog first; the server re-checks the admin and writes platform_audit. */
export const SupportActions = ({ workspaceId, status, invites }: SupportActionsProps) => {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [days, setDays] = useState("30");
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
        else done(await resendWorkspaceInvite(workspaceId, p.id), `Invitation resent to ${p.email}.`);
      } catch (e) {
        done({ ok: false, error: e instanceof Error ? e.message : String(e) }, "");
      }
    });
  };
  const n = Number(days);
  const daysOk = Number.isInteger(n) && n >= 1 && n <= 366;
  const sentence = !pending ? "" : pending.kind === "extend" ? `Extend the subscription by ${pending.days} days?` : pending.kind === "status" ? `Mark this workspace ${pending.to}?` : `Resend the invitation to ${pending.email}? The old link stops working.`;

  return (
    <SurfaceCard label="Support actions" headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">Manual, for support. Every action is confirmed here and logged in the audit trail. There is no impersonation.</Text>
        <div className={ACTION_CLASS}>
          <div className={ACTION_ROW_CLASS}>
            <Input id="extend-days" name="days" label="Extend subscription by (days)" variant="secondary" value={days} onValueChange={setDays} isError={!daysOk} errorMessage={daysOk ? undefined : "1 to 366"} />
            <Button variant="secondary" isDisabled={!daysOk || isPending} onPress={() => ask({ kind: "extend", days: n })}>Extend</Button>
          </div>
          <div className={ACTION_ROW_CLASS}>
            <Button variant="secondary" isDisabled={status === "active" || isPending} onPress={() => ask({ kind: "status", to: "active" })}>Mark active</Button>
            <Button variant="danger-soft" isDisabled={status === "past_due" || isPending} onPress={() => ask({ kind: "status", to: "past_due" })}>Mark past due</Button>
          </div>
          {invites.length > 0 ? (
            <div className={ACTION_ROW_CLASS}>
              {invites.map((i) => <Button key={i.id} variant="outline" size="sm" isDisabled={isPending} onPress={() => ask({ kind: "invite", id: i.id, email: i.email })}>{`Resend invite: ${i.email}`}</Button>)}
            </div>
          ) : null}
        </div>
        <AlertDialog
          isOpen={pending !== null}
          onOpenChange={(open) => { if (!open) setPending(null); }}
          title={sentence}
          tone={pending?.kind === "status" && pending.to === "past_due" ? "negative" : "informative"}
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          isConfirmPending={isPending}
          onConfirm={run}
          onCancel={() => setPending(null)}
        />
        {message ? <Alert tone={message.tone} title={message.tone === "affirmative" ? "Done" : "Could not do that"} description={message.text} /> : null}
      </div>
    </SurfaceCard>
  );
};

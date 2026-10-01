"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, Form, Input, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { account } from "@/i18n/dict/account";
import type { Outcome } from "@/lib/types";
import { changeEmail, changePassword, revokeSession, signOutCurrent, signOutOthers, updateProfile } from "./actions";
import {
  ACTIONS_CLASS_NAME,
  FACT_ROW_CLASS_NAME,
  FORM_CLASS_NAME,
  LIST_CLASS_NAME,
  PAGE_CLASS_NAME,
  SESSION_INFO_CLASS_NAME,
  SESSION_ROW_CLASS_NAME,
  SESSION_TITLE_CLASS_NAME,
} from "./classNames";

/** One device row, already formatted on the server (locale-aware, no hydration drift). */
export type SessionView = {
  readonly id: string;
  readonly device: string | null;
  readonly ip: string | null;
  readonly created: string;
  readonly lastActive: string;
  readonly isCurrent: boolean;
};

/** Props for {@link AccountView}. */
export type AccountViewProps = {
  readonly name: string;
  readonly email: string;
  readonly providers: ReadonlyArray<string>;
  readonly sessions: ReadonlyArray<SessionView>;
  readonly sessionsFailed: boolean;
};

/** Run a server action, tracking pending state and surfacing success or failure text. */
const useAction = () => {
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (task: () => Promise<Outcome<null>>, successText: string, after?: () => void) => {
    setError(null);
    setDone(null);
    start(async () => {
      const result = await task();
      if (result.ok) {
        setDone(successText);
        after?.();
      } else setError(result.error);
    });
  };
  return { isPending, error, done, run };
};

const Feedback = ({ error, done }: { readonly error: string | null; readonly done: string | null }) => {
  const t = useT(account);
  if (error) return <Alert tone="negative" title={t("failTitle")} description={error} />;
  if (done) return <Alert tone="affirmative" title={done} />;
  return null;
};

const ProfileCard = ({ name }: { readonly name: string }) => {
  const t = useT(account);
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [localError, setLocalError] = useState<string | null>(null);
  const a = useAction();
  const submit = () => {
    setLocalError(null);
    if (value.trim().length < 2) return setLocalError(t("errName"));
    a.run(() => updateProfile(value), t("profileSaved"), () => router.refresh());
  };
  return (
    <SurfaceCard label={t("profileTitle")} headingLevel={2}>
      <Form label={t("profileTitle")} onSubmit={submit} isPending={a.isPending}>
        <div className={FORM_CLASS_NAME}>
          <Input id="account-name" name="name" label={t("displayName")} hint={t("displayNameHint")} variant="secondary" isRequired isDisabled={a.isPending} value={value} onValueChange={setValue} />
          <Feedback error={localError ?? a.error} done={localError ? null : a.done} />
          <div className={ACTIONS_CLASS_NAME}>
            <Button type="submit" variant="primary" isPending={a.isPending}>{t("saveProfile")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
  );
};

const EmailCard = ({ email }: { readonly email: string }) => {
  const t = useT(account);
  const [isEditing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const a = useAction();
  return (
    <SurfaceCard label={t("emailTitle")} headingLevel={2}>
      <div className={FORM_CLASS_NAME}>
        <div>
          <Text size="sm" tone="muted">{t("emailCurrent")}</Text>
          <Text weight="medium">{email}</Text>
        </div>
        <Text size="sm" tone="muted">{t("emailHint")}</Text>
        {isEditing ? (
          <Form label={t("changeEmail")} onSubmit={() => a.run(() => changeEmail(value), t("emailSent"), () => { setEditing(false); setValue(""); })} isPending={a.isPending}>
            <div className={FORM_CLASS_NAME}>
              <Input id="account-new-email" name="email" kind="email" label={t("newEmail")} variant="secondary" isRequired isDisabled={a.isPending} value={value} onValueChange={setValue} />
              <div className={ACTIONS_CLASS_NAME}>
                <Button type="submit" variant="primary" isPending={a.isPending}>{t("sendConfirm")}</Button>
                <Button variant="outline" isDisabled={a.isPending} onPress={() => setEditing(false)}>{t("cancel")}</Button>
              </div>
            </div>
          </Form>
        ) : (
          <div className={ACTIONS_CLASS_NAME}>
            <Button variant="secondary" onPress={() => setEditing(true)}>{t("changeEmail")}</Button>
          </div>
        )}
        <Feedback error={a.error} done={a.done} />
      </div>
    </SurfaceCard>
  );
};

const PasswordCard = () => {
  const t = useT(account);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const a = useAction();
  const submit = () => {
    setLocalError(null);
    if (!current) return setLocalError(t("errCurrent"));
    if (next.length < 8) return setLocalError(t("errMin"));
    if (next !== confirm) return setLocalError(t("errMatch"));
    a.run(() => changePassword(current, next, confirm), t("passwordSaved"), () => { setCurrent(""); setNext(""); setConfirm(""); });
  };
  return (
    <SurfaceCard label={t("passwordTitle")} headingLevel={2}>
      <Form label={t("passwordTitle")} onSubmit={submit} isPending={a.isPending}>
        <div className={FORM_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("passwordHint")}</Text>
          <Input id="account-current-password" name="current" kind="password" label={t("currentPassword")} variant="secondary" isRequired isDisabled={a.isPending} value={current} onValueChange={setCurrent} />
          <Input id="account-new-password" name="next" kind="newPassword" label={t("newPassword")} variant="secondary" isRequired isDisabled={a.isPending} value={next} onValueChange={setNext} />
          <Input id="account-confirm-password" name="confirm" kind="newPassword" label={t("confirmPassword")} variant="secondary" isRequired isDisabled={a.isPending} value={confirm} onValueChange={setConfirm} />
          <Feedback error={localError ?? a.error} done={localError ? null : a.done} />
          <div className={ACTIONS_CLASS_NAME}>
            <Button type="submit" variant="primary" isPending={a.isPending}>{t("changePassword")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
  );
};

const MethodsCard = ({ providers }: { readonly providers: ReadonlyArray<string> }) => {
  const t = useT(account);
  const rows = [
    { key: "google", label: t("methodGoogle") },
    { key: "email", label: t("methodEmail") },
  ];
  return (
    <SurfaceCard label={t("methodsTitle")} headingLevel={2}>
      <ul className={LIST_CLASS_NAME}>
        {rows.map((row) => {
          const linked = providers.includes(row.key);
          return (
            <li key={row.key} className={FACT_ROW_CLASS_NAME}>
              <Text weight="medium">{row.label}</Text>
              <Badge tone={linked ? "success" : "neutral"}>{linked ? t("methodLinked") : t("methodNotLinked")}</Badge>
            </li>
          );
        })}
      </ul>
    </SurfaceCard>
  );
};

const SessionsCard = ({ sessions, failed }: { readonly sessions: ReadonlyArray<SessionView>; readonly failed: boolean }) => {
  const t = useT(account);
  const router = useRouter();
  const a = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.isCurrent);
  const revoke = (id: string) => {
    setBusyId(id);
    a.run(() => revokeSession(id), t("sessionRevoked"), () => router.refresh());
  };
  return (
    <SurfaceCard label={t("sessionsTitle")} headingLevel={2}>
      <div className={LIST_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("sessionsHint")}</Text>
        {failed ? <Alert tone="negative" title={t("sessionsFailed")} /> : null}
        <ul className={LIST_CLASS_NAME} aria-label={t("sessionsTitle")}>
          {sessions.map((s) => (
            <li key={s.id} className={SESSION_ROW_CLASS_NAME} data-testid="session-row" data-current={s.isCurrent ? "1" : "0"}>
              <div className={SESSION_INFO_CLASS_NAME}>
                <div className={SESSION_TITLE_CLASS_NAME}>
                  <Text weight="medium">{s.device ?? t("deviceUnknown")}</Text>
                  {s.isCurrent ? <Badge tone="accent" isDot>{t("current")}</Badge> : null}
                </div>
                <Text size="sm" tone="muted">{[s.ip ? `${t("ipLabel")} ${s.ip}` : null, t("created", { when: s.created }), t("lastActive", { when: s.lastActive })].filter(Boolean).join(" · ")}</Text>
              </div>
              {s.isCurrent ? (
                <form action={signOutCurrent}>
                  <Button type="submit" variant="outline">{t("signOutThis")}</Button>
                </form>
              ) : (
                <Button variant="outline" isPending={a.isPending && busyId === s.id} isDisabled={a.isPending} onPress={() => revoke(s.id)}>{t("signOut")}</Button>
              )}
            </li>
          ))}
        </ul>
        <Feedback error={a.error} done={a.done} />
        <div className={ACTIONS_CLASS_NAME}>
          {others.length > 0 ? (
            <Button variant="danger-soft" isPending={a.isPending && busyId === null} isDisabled={a.isPending} onPress={() => { setBusyId(null); a.run(signOutOthers, t("othersDone"), () => router.refresh()); }}>
              {t("signOutOthers")}
            </Button>
          ) : (
            <Text size="sm" tone="muted">{t("noOthers")}</Text>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
};

/** The /account screen: profile, email, password, sign-in methods and device sessions. */
export const AccountView = ({ name, email, providers, sessions, sessionsFailed }: AccountViewProps) => {
  const t = useT(account);
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <ProfileCard name={name} />
        <EmailCard email={email} />
        <PasswordCard />
        <MethodsCard providers={providers} />
        <SessionsCard sessions={sessions} failed={sessionsFailed} />
      </div>
    </PageContainer>
  );
};

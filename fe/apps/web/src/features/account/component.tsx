"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Breadcrumbs, Button, DescriptionList, Form, Input, ListItem, PageContainer, Region, SectionHeader, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { account } from "@/i18n/dict/account";
import type { Outcome } from "@/lib/types";
import { changeEmail, changePassword, revokeSession, signOutCurrent, signOutOthers, updateProfile } from "./actions";
import {
  ACTIONS_CLASS_NAME,
  FORM_CLASS_NAME,
  HEAD_CLASS_NAME,
  PAGE_CLASS_NAME,
  SECTION_CLASS_NAME,
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
  /** STATE-8: the same page while its data loads - labels stay, values and the device rows are skeletons. */
  readonly isLoading?: boolean;
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

const ProfileCard = ({ name, isLoading }: { readonly name: string; readonly isLoading: boolean }) => {
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
          <Input id="account-name" name="name" label={t("displayName")} hint={t("displayNameHint")} variant="secondary" isRequired isDisabled={a.isPending} isSkeleton={isLoading} value={value} onValueChange={setValue} />
          <Feedback error={localError ?? a.error} done={localError ? null : a.done} />
          <div className={ACTIONS_CLASS_NAME}>
            <Button type="submit" variant="primary" isPending={a.isPending} isSkeleton={isLoading}>{t("saveProfile")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
  );
};

const EmailCard = ({ email, isLoading }: { readonly email: string; readonly isLoading: boolean }) => {
  const t = useT(account);
  const [isEditing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const a = useAction();
  return (
    <SurfaceCard label={t("emailTitle")} headingLevel={2}>
      <div className={FORM_CLASS_NAME}>
        <DescriptionList layout="stacked" isLoading={isLoading} items={[{ id: "email", term: t("emailCurrent"), description: <Text weight="medium">{email}</Text> }]} />
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
            <Button variant="secondary" isSkeleton={isLoading} onPress={() => setEditing(true)}>{t("changeEmail")}</Button>
          </div>
        )}
        <Feedback error={a.error} done={a.done} />
      </div>
    </SurfaceCard>
  );
};

const PasswordCard = ({ isLoading }: { readonly isLoading: boolean }) => {
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
          <Input id="account-current-password" name="current" kind="password" label={t("currentPassword")} variant="secondary" isRequired isDisabled={a.isPending} isSkeleton={isLoading} value={current} onValueChange={setCurrent} />
          <Input id="account-new-password" name="next" kind="newPassword" label={t("newPassword")} variant="secondary" isRequired isDisabled={a.isPending} isSkeleton={isLoading} value={next} onValueChange={setNext} />
          <Input id="account-confirm-password" name="confirm" kind="newPassword" label={t("confirmPassword")} variant="secondary" isRequired isDisabled={a.isPending} isSkeleton={isLoading} value={confirm} onValueChange={setConfirm} />
          <Feedback error={localError ?? a.error} done={localError ? null : a.done} />
          <div className={ACTIONS_CLASS_NAME}>
            <Button type="submit" variant="primary" isPending={a.isPending} isSkeleton={isLoading}>{t("changePassword")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
  );
};

const MethodsCard = ({ providers, isLoading }: { readonly providers: ReadonlyArray<string>; readonly isLoading: boolean }) => {
  const t = useT(account);
  const rows = [
    { key: "google", label: t("methodGoogle") },
    { key: "email", label: t("methodEmail") },
  ];
  return (
    <SurfaceCard label={t("methodsTitle")} headingLevel={2}>
      <DescriptionList
        layout="columns"
        isLoading={isLoading}
        isDivided
        items={rows.map((row) => {
          const linked = providers.includes(row.key);
          return {
            id: row.key,
            term: row.label,
            description: <Badge tone={linked ? "success" : "neutral"}>{linked ? t("methodLinked") : t("methodNotLinked")}</Badge>,
          };
        })}
      />
    </SurfaceCard>
  );
};

const SessionsCard = ({ sessions, failed, isLoading }: { readonly sessions: ReadonlyArray<SessionView>; readonly failed: boolean; readonly isLoading: boolean }) => {
  const t = useT(account);
  const router = useRouter();
  const a = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSigningOut, startSignOut] = useTransition();
  const others = sessions.filter((s) => !s.isCurrent);
  const revoke = (id: string) => {
    setBusyId(id);
    a.run(() => revokeSession(id), t("sessionRevoked"), () => router.refresh());
  };
  return (
    <Region labelledBy="account-sessions-title" className={SECTION_CLASS_NAME}>
      <SectionHeader id="account-sessions-title" level={2} title={t("sessionsTitle")} description={t("sessionsHint")} />
      {failed ? <Alert tone="negative" title={t("sessionsFailed")} /> : null}
      <SurfaceListCard ariaLabel={t("sessionsTitle")} isLoading={isLoading}>
        {isLoading ? undefined : sessions.map((s) => (
          <ListItem key={s.id} className={SESSION_ROW_CLASS_NAME} data-testid="session-row" data-current={s.isCurrent ? "1" : "0"}>
            <div className={SESSION_INFO_CLASS_NAME}>
              <div className={SESSION_TITLE_CLASS_NAME}>
                <Text weight="medium">{s.device ?? t("deviceUnknown")}</Text>
                {s.isCurrent ? <Badge tone="accent" isDot>{t("current")}</Badge> : null}
              </div>
              <Text size="sm" tone="muted">{[s.ip ? `${t("ipLabel")} ${s.ip}` : null, t("created", { when: s.created }), t("lastActive", { when: s.lastActive })].filter(Boolean).join(" · ")}</Text>
            </div>
            {s.isCurrent ? (
              <Button variant="outline" isPending={isSigningOut} isDisabled={a.isPending} onPress={() => startSignOut(async () => { await signOutCurrent(); })}>{t("signOutThis")}</Button>
            ) : (
              <Button variant="outline" isPending={a.isPending && busyId === s.id} isDisabled={a.isPending} onPress={() => revoke(s.id)}>{t("signOut")}</Button>
            )}
          </ListItem>
        ))}
      </SurfaceListCard>
      <Feedback error={a.error} done={a.done} />
      <div className={ACTIONS_CLASS_NAME}>
        {isLoading ? null : others.length > 0 ? (
          <Button variant="danger-soft" isPending={a.isPending && busyId === null} isDisabled={a.isPending} onPress={() => { setBusyId(null); a.run(signOutOthers, t("othersDone"), () => router.refresh()); }}>
            {t("signOutOthers")}
          </Button>
        ) : (
          <Text size="sm" tone="muted">{t("noOthers")}</Text>
        )}
      </div>
    </Region>
  );
};

/** The /account screen: profile, email, password, sign-in methods and device sessions. */
export const AccountView = ({ name, email, providers, sessions, sessionsFailed, isLoading = false }: AccountViewProps) => {
  const t = useT(account);
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <div className={HEAD_CLASS_NAME}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "account", label: t("title") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </div>
        <ProfileCard name={name} isLoading={isLoading} />
        <EmailCard email={email} isLoading={isLoading} />
        <PasswordCard isLoading={isLoading} />
        <MethodsCard providers={providers} isLoading={isLoading} />
        <SessionsCard sessions={sessions} failed={sessionsFailed} isLoading={isLoading} />
      </div>
    </PageContainer>
  );
};

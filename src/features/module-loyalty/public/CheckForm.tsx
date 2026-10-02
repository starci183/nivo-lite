"use client";

import { useState, useTransition } from "react";
import { Alert, Badge, Button, Form, Heading, Input, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { loyaltyPublic } from "@/i18n/dict/loyaltyPublic";
import { requestCodeAction, verifyCodeAction, type PublicResult } from "./actions";
import { CARD_CLASS_NAME, FIGURES_CLASS_NAME, FIGURE_CLASS_NAME, FORM_CLASS_NAME, LIST_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";

/** Props for {@link CheckForm}. */
export type CheckFormProps = {
  readonly slug: string;
  readonly shop: string;
};

type Step = "phone" | "code" | "result";

const vnd = (n: number): string => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
const day = (iso: string | null): string => (iso ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "");

/** Phone, then the code sent to the customer's own chat, then their points. Never shows anything about a number before the code is right. */
export const CheckForm = ({ slug, shop }: CheckFormProps) => {
  const t = useT(loyaltyPublic);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const sendCode = () => {
    setError(null);
    startTransition(async () => {
      const out = await requestCodeAction(slug, phone).catch(() => ({ ok: false as const, error: t("unavailable") }));
      if (out.ok) setStep("code");
      else setError(out.error);
    });
  };

  const check = () => {
    setError(null);
    startTransition(async () => {
      const out = await verifyCodeAction(slug, phone, code).catch(() => ({ ok: false as const, error: t("unavailable") }));
      if (out.ok) {
        setResult(out.result);
        setStep("result");
      } else setError(out.error);
    });
  };

  if (step === "result" && result) {
    return (
      <SurfaceCard ariaLabel={t("hello", { name: result.name })}>
        <div className={CARD_CLASS_NAME}>
          <Heading level={2} scale="standard">{t("hello", { name: result.name })}</Heading>
          <div className={FIGURES_CLASS_NAME}>
            <div className={FIGURE_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="medium">{t("tier")}</Text>
              <Text size="metric-lead" weight="semibold">{result.tierName ?? t("noTier")}</Text>
            </div>
            <div className={FIGURE_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="medium">{t("points")}</Text>
              <Text size="metric-lead" weight="semibold">{result.points.toLocaleString("vi-VN")}</Text>
            </div>
          </div>
          {result.nextTier ? <Text size="sm" tone="muted">{t("nextTier", { amount: vnd(result.nextTier.missingVnd), tier: result.nextTier.name })}</Text> : null}
          {result.expiring.points > 0 ? <Alert tone="affirmative" title={t("expiring", { points: result.expiring.points.toLocaleString("vi-VN"), date: day(result.expiring.firstAt) })} /> : null}
          <Heading level={3} scale="standard">{t("rewardsTitle")}</Heading>
          {result.rewards.length === 0 ? (
            <Text tone="muted">{t("noRewards")}</Text>
          ) : (
            <ul className={LIST_CLASS_NAME}>
              {result.rewards.map((r) => (
                <li key={r.name} className={ROW_CLASS_NAME}>
                  <div className={ROW_MAIN_CLASS_NAME}>
                    <Text weight="semibold">{r.name}</Text>
                    <Text size="sm" tone="muted">{r.pointsCost.toLocaleString("vi-VN")} {t("pointsUnit")}{r.note ? ` · ${r.note}` : ""}</Text>
                  </div>
                  <Badge tone={r.canRedeem ? "success" : "neutral"}>{r.canRedeem ? t("canRedeem") : t("needMore")}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Text size="sm" tone="muted">{t("redeemHint")}</Text>
          <Button variant="outline" onPress={() => { setStep("phone"); setCode(""); setResult(null); }}>{t("back")}</Button>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard ariaLabel={t("title")}>
      <div className={CARD_CLASS_NAME}>
        <Heading level={1} scale="standard">{t("title")}</Heading>
        {step === "phone" ? (
          <>
            <Text tone="muted">{t("lead", { shop })}</Text>
            <Form label={t("title")} onSubmit={sendCode} isPending={isPending}>
              <div className={FORM_CLASS_NAME}>
                <Input id="loyalty-phone" name="phone" label={t("phoneLabel")} placeholder={t("phonePlaceholder")} variant="secondary" isRequired isDisabled={isPending} value={phone} onValueChange={setPhone} />
                <Button variant="primary" width="fill" type="submit" isPending={isPending}>{t("sendCode")}</Button>
              </div>
            </Form>
          </>
        ) : (
          <>
            <Alert tone="affirmative" title={t("sentTitle")} description={t("sentBody")} />
            <Form label={t("check")} onSubmit={check} isPending={isPending}>
              <div className={FORM_CLASS_NAME}>
                <Input id="loyalty-code" name="code" kind="code" label={t("codeLabel")} variant="secondary" isRequired isDisabled={isPending} value={code} onValueChange={setCode} />
                <Button variant="primary" width="fill" type="submit" isPending={isPending}>{t("check")}</Button>
              </div>
            </Form>
            <Button variant="outline" isDisabled={isPending} onPress={sendCode}>{t("resend")}</Button>
            <Button variant="tertiary" isDisabled={isPending} onPress={() => { setStep("phone"); setCode(""); setError(null); }}>{t("back")}</Button>
          </>
        )}
        {error ? <Alert tone="negative" title={error} /> : null}
      </div>
    </SurfaceCard>
  );
};

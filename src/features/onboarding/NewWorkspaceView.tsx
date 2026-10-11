"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, Form, Icon, Input, List, ListItem, RadioGroup, SectionHeader, Select, SurfaceCard, Text } from "@starci/grammar/common";
import { nivoIconSource } from "@/ui";
import { useLocale, useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import type { Plan } from "@/lib/billing";
import { createWorkspaceAction } from "./actions";
import { BUSINESS_TYPES } from "./constants";
import { Stepper } from "./Stepper";
import { useMoney } from "./useMoney";
import {
  ACTIONS_CLASS_NAME, FEATURES_CLASS_NAME, PLAN_BODY_CLASS_NAME, PLAN_LABEL_CLASS_NAME, PRICE_CLASS_NAME, STACK_CLASS_NAME, STACK_MD_CLASS_NAME,
} from "./classNames";

/** Props for {@link NewWorkspaceView}. */
export type NewWorkspaceViewProps = { readonly plans: ReadonlyArray<Plan> };

const TYPE_KEY = { retail: "typeRetail", services: "typeServices", clinic: "typeClinic", education: "typeEducation", other: "typeOther" } as const;
/** The plan highlighted as "most popular" (the one most workspaces need). */
const RECOMMENDED_PLAN = "growth";

/** /workspaces/new: step 1 choose a plan, step 2 name + business type; step 3 (payment) is its own page. */
export const NewWorkspaceView = ({ plans }: NewWorkspaceViewProps) => {
  const t = useT(onboarding);
  const locale = useLocale();
  const money = useMoney();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [planCode, setPlanCode] = useState<string>((plans.find((p) => p.code === RECOMMENDED_PLAN) ?? plans[0])?.code ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("retail");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const submit = () => {
    setError(null);
    if (name.trim().length < 2) return setError(t("errName"));
    start(async () => {
      const res = await createWorkspaceAction({ planCode, name, businessType: type });
      if (res.ok) router.push(`/workspaces/new/payment?order=${res.data.orderId}`);
      else setError(res.error);
    });
  };

  const planOptions = plans.map((p) => ({
    value: p.code,
    label: (
      <span className={PLAN_LABEL_CLASS_NAME}>
        {locale === "vi" ? p.name_vi : p.name_en}
        {p.code === RECOMMENDED_PLAN ? <Badge tone="accent">{t("recommended")}</Badge> : null}
      </span>
    ),
    description: (
      <span className={PLAN_BODY_CLASS_NAME}>
        <Text as="span" size="sm" tone="muted">{t("seats", { n: p.seats })}</Text>
        <span className={PRICE_CLASS_NAME}>
          <Text as="span" size="metric-lead" weight="semibold">{money(Number(p.price_vnd))}</Text>
          <Text as="span" size="sm" tone="muted">{p.period === "year" ? t("perYear") : t("perMonth")}</Text>
        </span>
        <List className={FEATURES_CLASS_NAME}>
          {(p.features[locale] ?? []).map((f) => (
            <ListItem key={f}>
              <Text as="span" size="sm" startContent={<Icon source={nivoIconSource("complete", "chip")} usage="chip" />}>{f}</Text>
            </ListItem>
          ))}
        </List>
      </span>
    ),
  }));

  return (
    <div className={STACK_CLASS_NAME}>
      <Stepper steps={[t("stepPlan"), t("stepWorkspace"), t("stepPayment")]} current={step} label={t("newTitle")} />
      {step === 1 ? (
        <>
          <SectionHeader level={1} title={t("choosePlan")} description={t("choosePlanText")} />
          <RadioGroup label={t("choosePlan")} isLabelHidden options={planOptions} value={planCode} onValueChange={setPlanCode} />
          <div className={ACTIONS_CLASS_NAME}>
            <Button variant="primary" size="lg" isDisabled={!planCode} onPress={() => setStep(2)}>{t("next")}</Button>
            <Button variant="ghost" href="/workspaces">{t("cancel")}</Button>
          </div>
        </>
      ) : (
        <>
          <SectionHeader level={1} title={t("nameTitle")} description={t("nameText")} />
          <SurfaceCard ariaLabel={t("stepWorkspace")} measure="form">
            <Form label={t("stepWorkspace")} onSubmit={submit} isPending={isPending}>
              <div className={STACK_MD_CLASS_NAME}>
                <Input id="onb-name" name="name" label={t("workspaceName")} hint={t("workspaceNameHint")} variant="secondary" isRequired isDisabled={isPending} value={name} onValueChange={setName} />
                <Select
                  name="type"
                  label={t("businessType")}
                  variant="secondary"
                  isDisabled={isPending}
                  value={type}
                  onValueChange={(v) => v && setType(v)}
                  options={BUSINESS_TYPES.map((k) => ({ id: k, label: t(TYPE_KEY[k]) }))}
                />
                {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
                <div className={ACTIONS_CLASS_NAME}>
                  <Button type="submit" variant="primary" size="lg" isPending={isPending}>{isPending ? t("creating") : t("createAndPay")}</Button>
                  <Button variant="ghost" isDisabled={isPending} onPress={() => setStep(1)}>{t("back")}</Button>
                </div>
              </div>
            </Form>
          </SurfaceCard>
        </>
      )}
    </div>
  );
};

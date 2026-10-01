"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Form, Input, Select } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import type { Plan } from "@/lib/billing";
import { createWorkspaceAction } from "./actions";
import { BUSINESS_TYPES } from "./constants";
import { Stepper } from "./Stepper";
import { useMoney } from "./useMoney";
import {
  ACTIONS_CLASS_NAME, CARD_CLASS_NAME, CHECK_CLASS_NAME, FEATURES_CLASS_NAME, FEATURE_CLASS_NAME, H1_CLASS_NAME, MUTED_CLASS_NAME, PLANS_CLASS_NAME,
  PLAN_CLASS_NAME, PLAN_ON_CLASS_NAME, PLAN_TAG_CLASS_NAME, PRICE_BIG_CLASS_NAME, PRICE_CLASS_NAME, RADIO_CLASS_NAME, STACK_CLASS_NAME, STACK_SM_CLASS_NAME,
} from "./classNames";

/** Props for {@link NewWorkspaceView}. */
export type NewWorkspaceViewProps = { readonly plans: ReadonlyArray<Plan> };

const TYPE_KEY = { retail: "typeRetail", services: "typeServices", clinic: "typeClinic", education: "typeEducation", other: "typeOther" } as const;
/** The plan highlighted as "most popular" (the one most workspaces need). */
const RECOMMENDED_PLAN = "growth";

const Check = () => (
  <svg viewBox="0 0 16 16" className={CHECK_CLASS_NAME} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

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

  return (
    <div>
      <div className={STACK_CLASS_NAME}>
        <Stepper steps={[t("stepPlan"), t("stepWorkspace"), t("stepPayment")]} current={step} label={t("newTitle")} />
        {step === 1 ? (
          <>
            <div className={STACK_SM_CLASS_NAME}>
              <h1 className={H1_CLASS_NAME}>{t("choosePlan")}</h1>
              <p className={MUTED_CLASS_NAME}>{t("choosePlanText")}</p>
            </div>
            <div className={PLANS_CLASS_NAME} role="radiogroup" aria-label={t("choosePlan")}>
              {plans.map((p) => {
                const on = p.code === planCode;
                return (
                  <button key={p.code} type="button" role="radio" aria-checked={on} className={`${PLAN_CLASS_NAME} ${on ? PLAN_ON_CLASS_NAME : ""}`} onClick={() => setPlanCode(p.code)}>
                    {p.code === RECOMMENDED_PLAN ? <span className={PLAN_TAG_CLASS_NAME}>{t("recommended")}</span> : null}
                    <span className={`${RADIO_CLASS_NAME} ${on ? "border-accent bg-accent text-white" : "border-divider text-transparent"}`} aria-hidden="true">
                      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
                    </span>
                    <span className="flex flex-col gap-1 pr-8">
                      <span className="text-lg font-semibold text-foreground">{locale === "vi" ? p.name_vi : p.name_en}</span>
                      <span className="text-sm text-muted">{t("seats", { n: p.seats })}</span>
                    </span>
                    <span className={PRICE_CLASS_NAME}>
                      <span className={PRICE_BIG_CLASS_NAME}>{money(Number(p.price_vnd))}</span>
                      <span className="text-sm text-muted">{p.period === "year" ? t("perYear") : t("perMonth")}</span>
                    </span>
                    <ul className={FEATURES_CLASS_NAME}>
                      {(p.features[locale] ?? []).map((f) => (
                        <li key={f} className={FEATURE_CLASS_NAME}><Check />{f}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <div className={ACTIONS_CLASS_NAME}>
              <Button variant="primary" size="lg" isDisabled={!planCode} onPress={() => setStep(2)}>{t("next")}</Button>
              <Button variant="ghost" href="/workspaces">{t("cancel")}</Button>
            </div>
          </>
        ) : (
          <>
            <div className={STACK_SM_CLASS_NAME}>
              <h1 className={H1_CLASS_NAME}>{t("nameTitle")}</h1>
              <p className={MUTED_CLASS_NAME}>{t("nameText")}</p>
            </div>
            <div className={`${CARD_CLASS_NAME} max-w-xl`}>
              <Form label={t("stepWorkspace")} onSubmit={submit} isPending={isPending}>
                <div className={STACK_CLASS_NAME}>
                  <Input id="onb-name" name="name" label={t("workspaceName")} hint={t("workspaceNameHint")} variant="secondary" isRequired isDisabled={isPending} value={name} onValueChange={setName} />
                  <Select
                    name="type"
                    label={t("businessType")}
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};

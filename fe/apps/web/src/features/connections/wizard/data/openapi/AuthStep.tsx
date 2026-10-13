"use client"

import { Input, Select } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { OPEN_API_AUTH_TYPES } from "@/hooks/openapi-wizard"
import type { OpenApiAuthValues } from "@/hooks/rhf"
import { COLUMN_CLASS } from "./classNames"

/** What the auth step shows and changes. */
export type AuthStepProps = {
  readonly form: UseFormReturn<OpenApiAuthValues>
  readonly hasSecret: boolean
  readonly isDisabled: boolean
}

/** Step "auth": base URL, auth type and the key, token or user and password. */
export const AuthStep = ({ form, hasSecret, isDisabled }: AuthStepProps) => {
  const t = useTranslations("connectorOpenapi")
  const authType = form.watch("authType")
  const keyed = authType === "header" || authType === "query"
  return (
    <div className={COLUMN_CLASS}>
      <Controller
        control={form.control}
        name="baseUrl"
        render={({ field, fieldState }) => (
          <Input id="oa-base" name="baseUrl" label={t("fieldBaseUrl")} variant="secondary" hint={fieldState.error?.message ?? t("fieldBaseUrlHint")} isDisabled={isDisabled} value={field.value} onValueChange={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="authType"
        render={({ field }) => (
          <Select
            label={t("fieldAuth")}
            variant="secondary"
            options={OPEN_API_AUTH_TYPES.map((a) => ({ id: a, label: t(`auth_${a}`) }))}
            value={field.value}
            onValueChange={(v) => {
              const next = OPEN_API_AUTH_TYPES.find((a) => a === v)
              if (next) field.onChange(next)
            }}
          />
        )}
      />
      {keyed ? (
        <Controller
          control={form.control}
          name="authName"
          render={({ field, fieldState }) => (
            <Input id="oa-auth-name" name="authName" label={authType === "header" ? t("fieldHeaderName") : t("fieldQueryName")} variant="secondary" hint={fieldState.error?.message} isDisabled={isDisabled} value={field.value} onValueChange={field.onChange} />
          )}
        />
      ) : null}
      {keyed || authType === "bearer" ? (
        <Controller
          control={form.control}
          name="authValue"
          render={({ field }) => (
            <Input id="oa-auth-value" name="authValue" label={authType === "bearer" ? t("fieldToken") : t("fieldKeyValue")} variant="secondary" kind="password" hint={hasSecret ? t("keepSecretHint") : undefined} isDisabled={isDisabled} value={field.value} onValueChange={field.onChange} />
          )}
        />
      ) : null}
      {authType === "basic" ? (
        <>
          <Controller
            control={form.control}
            name="authUser"
            render={({ field }) => (
              <Input id="oa-auth-user" name="authUser" label={t("fieldUser")} variant="secondary" isDisabled={isDisabled} value={field.value} onValueChange={field.onChange} />
            )}
          />
          <Controller
            control={form.control}
            name="authPassword"
            render={({ field }) => (
              <Input id="oa-auth-pass" name="authPass" label={t("fieldPassword")} variant="secondary" kind="password" hint={hasSecret ? t("keepSecretHint") : undefined} isDisabled={isDisabled} value={field.value} onValueChange={field.onChange} />
            )}
          />
        </>
      ) : null}
    </div>
  )
}

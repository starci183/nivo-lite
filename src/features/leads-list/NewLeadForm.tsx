"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Form, Input, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { createLead } from "@/lib/actions"
import { useT } from "@/i18n/client"
import { leads as leadsDict } from "@/i18n/dict/leads"
import { ACTIONS_CLASS, FORM_GRID_CLASS, FORM_WIDE_CLASS } from "./classNames"
import { CHANNEL_KEYS, type LeadsT } from "./stage"

/** Props for {@link NewLeadForm}. */
export type NewLeadFormProps = { readonly onCancel: () => void }

type Values = { contact_name: string; company: string; channel: string; need: string }
type Errors = Partial<Record<keyof Values, string>>

const EMPTY: Values = { contact_name: "", company: "", channel: "", need: "" }

const validate = (v: Values, t: LeadsT): Errors => {
  const errors: Errors = {}
  if (v.contact_name.trim().length < 2) errors.contact_name = t("errContact")
  if (v.company.trim().length < 2) errors.company = t("errCompany")
  if (!v.channel) errors.channel = t("errChannel")
  if (v.need.trim().length < 5) errors.need = t("errNeed")
  return errors
}

/** Capture a lead by hand; the AI adds context and an owner before the lead page opens. */
export const NewLeadForm = ({ onCancel }: NewLeadFormProps) => {
  const router = useRouter()
  const t = useT(leadsDict)
  const channelOptions = CHANNEL_KEYS.map((k) => ({ id: t(k), label: t(k) }))
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)

  const setField = (key: keyof Values, value: string) => setValues((prev) => ({ ...prev, [key]: value }))

  const onSubmit = () => {
    const found = validate(values, t)
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) return
    startTransition(async () => {
      const result = await createLead({
        contact_name: values.contact_name.trim(),
        company: values.company.trim(),
        channel: values.channel,
        need: values.need.trim(),
      })
      if (result.ok) {
        router.push(`/leads/${result.data.leadId}`)
      } else {
        setFailure(result.error)
      }
    })
  }

  return (
    <SurfaceCard label={t("formTitle")} headingLevel={2}>
      <Form label={t("formTitle")} onSubmit={onSubmit} isPending={isPending}>
        <div className={FORM_GRID_CLASS}>
          <div className={FORM_WIDE_CLASS}><Text size="sm" tone="muted">{t("formIntro")}</Text></div>
          <Input id="lead-contact" name="contact_name" label={t("formContact")} hint={t("formContactHint")} variant="secondary" isRequired isDisabled={isPending} value={values.contact_name} isError={Boolean(errors.contact_name)} errorMessage={errors.contact_name} onValueChange={(v) => setField("contact_name", v)} />
          <Input id="lead-company" name="company" label={t("formCompany")} hint={t("formCompanyHint")} variant="secondary" isRequired isDisabled={isPending} value={values.company} isError={Boolean(errors.company)} errorMessage={errors.company} onValueChange={(v) => setField("company", v)} />
          <Select label={t("formChannel")} name="channel" description={t("formChannelHint")} options={channelOptions} placeholder={t("formChannelPlaceholder")} isRequired isDisabled={isPending} value={values.channel || null} isInvalid={Boolean(errors.channel)} errorMessage={errors.channel} onValueChange={(v) => setField("channel", v ?? "")} />
          <Text size="sm" tone="muted">{t("formAfter")}</Text>
          <div className={FORM_WIDE_CLASS}>
            <Textarea label={t("formNeed")} name="need" description={t("formNeedHint")} rows={4} isRequired isDisabled={isPending} value={values.need} isInvalid={Boolean(errors.need)} errorMessage={errors.need} onValueChange={(v) => setField("need", v)} />
          </div>
          {failure ? <div className={FORM_WIDE_CLASS}><Alert title={t("formFailTitle")} description={failure} tone="negative" /></div> : null}
          {isPending ? <div className={FORM_WIDE_CLASS}><Text live="polite" size="sm" tone="muted">{t("formPending")}</Text></div> : null}
          <div className={ACTIONS_CLASS}>
            <Button variant="outline" isDisabled={isPending} onPress={onCancel}>{t("formCancel")}</Button>
            <Button variant="primary" type="submit" isPending={isPending}>{t("formSubmit")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
  )
}

"use client"

import { Input, Textarea } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { COLUMN_CLASS } from "./classNames"

/** What the source step shows and changes. */
export type SourceStepProps = {
  readonly name: string
  readonly specUrl: string
  readonly specText: string
  readonly isDisabled: boolean
  readonly onName: (value: string) => void
  readonly onSpecUrl: (value: string) => void
  readonly onSpecText: (value: string) => void
}

/** Step "source": the connection name, the spec link or the pasted spec. */
export const SourceStep = ({ name, specUrl, specText, isDisabled, onName, onSpecUrl, onSpecText }: SourceStepProps) => {
  const t = useTranslations("connectorOpenapi")
  return (
    <div className={COLUMN_CLASS}>
      <Input id="oa-name" name="name" label={t("fieldName")} variant="secondary" hint={t("fieldNameHint")} isDisabled={isDisabled} value={name} onValueChange={onName} />
      <Input id="oa-url" name="specUrl" label={t("fieldSpecUrl")} variant="secondary" hint={t("fieldSpecUrlHint")} isDisabled={isDisabled} value={specUrl} onValueChange={onSpecUrl} />
      <Textarea id="oa-text" label={t("fieldSpecText")} variant="secondary" description={t("fieldSpecTextHint")} rows={6} isDisabled={isDisabled} value={specText} onValueChange={onSpecText} />
    </div>
  )
}

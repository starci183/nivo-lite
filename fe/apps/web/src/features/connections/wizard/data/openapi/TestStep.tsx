"use client"

import { Alert, Input, Select, Text } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { openApiOpLabel } from "@/hooks/openapi-wizard"
import type { OpenApiOp, OpenApiPullDef } from "@/hooks/openapi-wizard"
import type { OpenApiTestType } from "@/modules/api"
import { COLUMN_CLASS } from "./classNames"

/** What the test step shows and changes. */
export type TestStepProps = {
  readonly testable: ReadonlyArray<OpenApiOp>
  readonly activeId: string | null
  readonly op: OpenApiOp | null
  readonly pull: OpenApiPullDef | undefined
  readonly query: string
  readonly testing: boolean
  readonly result: OpenApiTestType | null
  readonly onOp: (id: string | null) => void
  readonly onQuery: (value: string) => void
}

/** Step "test": calls one GET with the typed settings and shows what came back. */
export const TestStep = ({ testable, activeId, op, pull, query, testing, result, onOp, onQuery }: TestStepProps) => {
  const t = useTranslations("connectorOpenapi")
  return (
    <div className={COLUMN_CLASS}>
      <Text size="sm" tone="muted">{t("testHint")}</Text>
      {testable.length === 0 ? (
        <Text size="sm">{t("noGets")}</Text>
      ) : (
        <Select label={t("fieldTestOp")} variant="secondary" options={testable.map((o) => ({ id: o.id, label: openApiOpLabel(o) }))} value={activeId} onValueChange={onOp} />
      )}
      {op && !pull ? <Input id="oa-test-q" name="testQuery" label={t("fixedQuery")} variant="secondary" value={query} onValueChange={onQuery} /> : null}
      {testing ? <Text size="sm" live="polite">{t("testing")}</Text> : null}
      {result?.error ? <Alert tone="negative" title={result.error} /> : null}
      {result && !result.error ? (
        <Alert tone={result.itemCount > 0 ? "affirmative" : "informative"} title={t("testOk", { status: result.status, n: result.itemCount })} />
      ) : null}
      {result && !result.error && result.sampleKeys.length ? (
        <Text size="sm" tone="muted">{t("testFields", { fields: result.sampleKeys.join(", ") })}</Text>
      ) : null}
    </div>
  )
}

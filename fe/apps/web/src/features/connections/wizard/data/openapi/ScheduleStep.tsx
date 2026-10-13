"use client"

import { Select, Text } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { OPEN_API_SCHEDULES } from "@/hooks/openapi-wizard"
import { COLUMN_CLASS } from "./classNames"

/** What the schedule step shows and changes. */
export type ScheduleStepProps = {
  readonly hasPulls: boolean
  readonly schedule: string
  readonly onSchedule: (id: string) => void
}

/** Step "schedule": how often the pulled endpoints are read again. */
export const ScheduleStep = ({ hasPulls, schedule, onSchedule }: ScheduleStepProps) => {
  const t = useTranslations("connectorOpenapi")
  return (
    <div className={COLUMN_CLASS}>
      <Text size="sm" tone="muted">{hasPulls ? t("scheduleHint") : t("scheduleNone")}</Text>
      <Select
        label={t("fieldSchedule")}
        variant="secondary"
        isDisabled={!hasPulls}
        options={OPEN_API_SCHEDULES.map((s) => ({ id: s.id, label: t(`schedule_${s.id}`) }))}
        value={schedule}
        onValueChange={(v) => v && onSchedule(v)}
      />
    </div>
  )
}

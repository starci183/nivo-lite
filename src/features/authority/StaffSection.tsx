"use client"

import { useState } from "react"
import { Badge, Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { authority as dict } from "@/i18n/dict/authority"
import { saveStaff } from "@/lib/flow-actions"
import type { Staff } from "@/lib/flow-types"
import { FIELDS_CLASS, STAFF_ACTIONS_CLASS, STAFF_BODY_CLASS, STAFF_FORM_CLASS, STAFF_ROW_CLASS } from "./classNames"
import { SaveRow, useSaver } from "./SaveRow"

/** Props for {@link StaffSection}. */
export type StaffSectionProps = { readonly staff: ReadonlyArray<Staff> }

/** Optional staff list: add a person, deactivate or reactivate. Staff are never required for routine work. */
export const StaffSection = ({ staff }: StaffSectionProps) => {
  const t = useT(dict)
  const addSaver = useSaver()
  const toggleSaver = useSaver()
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [email, setEmail] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)

  const onAdd = () => {
    if (name.trim().length < 2) {
      setNameError(t("staffErrName"))
      return
    }
    setNameError(null)
    addSaver.run(async () => {
      const result = await saveStaff({ name: name.trim(), role: role.trim(), email: email.trim() || null, active: true })
      if (result.ok) {
        setName("")
        setRole("")
        setEmail("")
      }
      return result
    })
  }

  return (
    <SurfaceCard label={t("staffTitle")} headingLevel={2}>
      <div className={FIELDS_CLASS}>
        <Text size="sm" tone="muted">{t("staffDesc")}</Text>
        {staff.length === 0 ? (
          <Text size="sm">{t("staffEmpty")}</Text>
        ) : (
          <div>
            {staff.map((s) => (
              <div key={s.id} className={STAFF_ROW_CLASS}>
                <div className={STAFF_BODY_CLASS}>
                  <Text weight="semibold" overflow="truncate">{s.name}</Text>
                  <Text size="sm" tone="muted" overflow="truncate">{[s.role, s.email].filter(Boolean).join(" · ")}</Text>
                </div>
                <div className={STAFF_ACTIONS_CLASS}>
                  <Badge tone={s.active ? "success" : "neutral"}>{s.active ? t("staffActive") : t("staffInactive")}</Badge>
                  <Button variant="outline" isPending={toggleSaver.isPending} onPress={() => toggleSaver.run(() => saveStaff({ id: s.id, name: s.name, role: s.role, email: s.email, active: !s.active }))}>
                    {s.active ? t("staffDeactivate") : t("staffReactivate")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={STAFF_FORM_CLASS}>
          <Input id="staff-name" name="staff_name" label={t("staffName")} variant="secondary" value={name} isError={Boolean(nameError)} errorMessage={nameError} onValueChange={(v) => { setNameError(null); setName(v) }} />
          <Input id="staff-role" name="staff_role" label={t("staffRole")} variant="secondary" value={role} onValueChange={setRole} />
          <Input id="staff-email" name="staff_email" label={t("staffEmail")} kind="email" variant="secondary" value={email} onValueChange={setEmail} />
        </div>
        <SaveRow saver={addSaver} onSave={onAdd} label={t("staffAdd")} variant="secondary" />
        {toggleSaver.error ? <Text size="sm" live="assertive">{toggleSaver.error}</Text> : null}
      </div>
    </SurfaceCard>
  )
}

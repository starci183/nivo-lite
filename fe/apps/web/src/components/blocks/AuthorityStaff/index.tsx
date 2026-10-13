"use client"

import { useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useAuthorityStaff } from "@/hooks/authority"
import type { StaffRow } from "@/hooks/authority"
import { teamInviteHref } from "@/modules/routes"
import { AuthorityStaffBase } from "./component"
import type { StaffRowView } from "./component"

const SKELETON_ROWS: ReadonlyArray<StaffRowView> = [0, 1, 2].map((n) => ({
    id: String(n),
    name: "-",
    role: "-",
    hasAccount: false,
    inviteHref: null,
}))

/** The staff list: read from the back end; adding and deactivating staff has no back end operation yet, so the list is read-only. */
export const AuthorityStaff = () => {
    const t = useTranslations("authority")
    const slotLabels = useSlotLabels()
    const { slot, canInvite, reload } = useAuthorityStaff()
    const rowOf = (row: StaffRow): StaffRowView => ({
        id: row.id,
        name: row.name,
        role: row.role,
        hasAccount: row.hasAccount,
        inviteHref: canInvite && !row.hasAccount ? teamInviteHref(row.id) : null,
    })
    return (
        <AuthorityStaffBase
            props={{
                title: t("staffTitle"),
                description: t("staffDesc"),
                note: t("staffReadOnly"),
                hasAccountLabel: t("staffHasAccount"),
                inviteLabel: t("staffInvite"),
                slot: mapSlot(slot, (rows) => rows.map(rowOf)),
                placeholder: SKELETON_ROWS,
                slotLabels: slotLabels(t("staffEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}

"use client"

import { useTranslations } from "next-intl"
import { useConnectionsData } from "@/hooks/connections"
import { useDriveLife, useDrivePage } from "@/hooks/drive"
import type { DriveGrantStanding } from "@/hooks/drive"
import { ledgerStateOf } from "@/hooks/googleLedger"
import type { LedgerState } from "@/hooks/googleLedger"
import { useQueryGoogleStateSwr } from "@/hooks/swr"
import { lifecycleChipOf } from "@/modules/connection-lifecycle"
import type { Connection, ConnectionLifecycle, ConnectionLifecycleChip } from "@/modules/types"
import { firstEmailOf, googleLifeOf, servicesOnOf } from "./google.shared"

/** The view `useGoogleAccount` returns. */
export interface GoogleAccountView {
    /** The Google account's email; blank when no service gave one, undefined while it is read. */
    email: string | undefined
    /** Where the account stands in the shared life; null while it is read. */
    life: ConnectionLifecycle | null
    /** The status badge of that life; null while it is read. */
    chip: ConnectionLifecycleChip | null
    /** How many services are switched on; undefined while they are read. */
    servicesOn: number | undefined
    drive: DriveGrantStanding | undefined
    sheets: LedgerState | undefined
    /** The title of the Sheets ledger sheet, blank until chosen. */
    sheetTitle: string
    /** The workspace's Sheets connection record (provider `google`), when it has one that still runs. */
    sheetsRecord: Connection | undefined
}

/**
 * The one Google account of the workspace: its email (from the Drive grant, the Sheets ledger or the Sheets connection, in that
 * order), the services switched on inside it, and its status in the shared life. The back end keeps Drive and Sheets apart, so this
 * joins the two reads; it asks for nothing they do not already carry.
 */
export const useGoogleAccount = (): GoogleAccountView => {
    const t = useTranslations("connections")
    const driveLife = useDriveLife()
    const { slot } = useDrivePage()
    const sheetsRead = useQueryGoogleStateSwr()
    const data = useConnectionsData()
    const drivePage = "items" in slot ? slot.items : undefined
    const ledger = sheetsRead.data?.ledger
    const sheets = sheetsRead.isLoading ? undefined : ledgerStateOf(ledger?.state ?? "none")
    const record = data.items.find((item) => item.provider === "google" && item.status !== "disconnected")
    const life = googleLifeOf(driveLife.life, sheets)
    const drive = drivePage?.standing
    return {
        email: drivePage === undefined ? undefined : firstEmailOf(drivePage.email, ledger?.email, record?.meta.email),
        life,
        chip: life === null ? null : lifecycleChipOf(life, (key, values) => t(key, values)),
        servicesOn: sheets === undefined || drive === undefined ? undefined : servicesOnOf({ drive, sheets }),
        drive,
        sheets,
        sheetTitle: ledger?.sheetTitle ?? "",
        sheetsRecord: record,
    }
}

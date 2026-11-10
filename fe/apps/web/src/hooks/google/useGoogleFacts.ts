"use client"

import { useTranslations } from "next-intl"
import { useDriveFacts } from "@/hooks/drive"
import { mapSlot } from "@/hooks/slot"
import type { ConnectionFactView, DataSlot } from "@/modules/types"
import { permissionKeysOf } from "./google.shared"
import { useGoogleAccount } from "./useGoogleAccount"

/**
 * The details of the Google account: the account, the permissions it has given (per service), and what the back end reports of
 * Drive's reading (documents, last read, space). The back end returns no token, no date the account was added and no member who
 * added it, so those rows are not drawn.
 */
export const useGoogleFacts = (): DataSlot<ReadonlyArray<ConnectionFactView>> => {
    const t = useTranslations("driveConnection")
    const account = useGoogleAccount()
    const drive = useDriveFacts()
    const permissions = permissionKeysOf({ drive: account.drive, sheets: account.sheets }).map((key) => t(key))
    return mapSlot(drive, (facts) =>
        facts.map((fact): ConnectionFactView => {
            if (fact.id === "scope") {
                return {
                    id: "permissions",
                    label: t("factPermissions"),
                    value: permissions.length === 0 ? t("permNone") : permissions.join(" · "),
                }
            }
            if (fact.id === "account" && (account.email ?? "") !== "") return { ...fact, value: account.email ?? "" }
            return fact
        }),
    )
}

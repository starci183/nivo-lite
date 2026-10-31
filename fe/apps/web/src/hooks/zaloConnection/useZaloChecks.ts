"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { useMutateRecheckZaloConnectionSwr } from "@/hooks/swr"
import type { DataSlot, ZaloCheckLineView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"
import type { ZaloPageData } from "./useZaloPage"

type CheckRow = ZaloPageData["checks"][number]

/** The check list: the four parts of the connection with a verdict and a detail line, and the check run again. */
export const useZaloChecks = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const settle = useSettledGraphQL()
    const { slot, mutate } = useZaloPage(connectionId)
    const { trigger, isMutating } = useMutateRecheckZaloConnectionSwr()

    const at = (iso: string | null): string =>
        iso === null ? "-" : format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" })

    const detailOf = (row: CheckRow, page: ZaloPageData): string => {
        switch (row.code) {
            case "app_saved":
                return t("detailAppSaved", { mask: page.appSecretMask ?? "" })
            case "app_missing":
                return t("detailAppMissing")
            case "token_valid":
                return t("detailTokenValid", { at: at(row.at) })
            case "token_renewable":
                return t("detailTokenRenewable")
            case "token_expired":
                return t("detailTokenExpired", { at: at(row.at) })
            case "token_none":
                return t("detailTokenNone")
            case "webhook_no_secret":
                return t("detailWebhookNoSecret")
            case "webhook_silent":
                return t("detailWebhookSilent")
            case "webhook_receiving":
                return t("detailWebhookReceiving", { events: row.names.join(", ") || "-", at: at(row.at) })
            case "permissions_send_ok":
                return t("detailPermissionsOk")
            case "permissions_send_denied":
                return t("detailPermissionsDenied")
            default:
                return t("detailPermissionsUnknown")
        }
    }
    const titleOf = (key: string): string => {
        switch (key) {
            case "app":
                return t("checkApp")
            case "token":
                return t("checkToken")
            case "webhook":
                return t("checkWebhook")
            default:
                return t("checkPermissions")
        }
    }
    const markOf = (state: string): ZaloCheckLineView["mark"] => {
        if (state === "ok") return "ok"
        return state === "fail" ? "fail" : "warn"
    }

    const lines: DataSlot<ReadonlyArray<ZaloCheckLineView>> = mapSlot(slot, (page) =>
        page.checks.map((row) => ({
            key: row.key,
            mark: markOf(row.state),
            title: titleOf(row.key),
            detail: detailOf(row, page),
        })),
    )

    const recheck = useCallback(async (): Promise<void> => {
        const result = await settle(() => trigger({ connectionId }), t("toastRechecked"))
        if (result.kind === "ok") await mutate(result.value, { revalidate: false })
    }, [settle, trigger, connectionId, t, mutate])

    return { lines, recheck, isRechecking: isMutating }
}

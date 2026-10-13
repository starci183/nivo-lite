"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Alert, Button } from "@starci/grammar/common"
import { writePaymentOrderRequest } from "@/modules/db/billing/write-payment-order-request"
import { navigation } from "@/modules/i18n"
import { RENEW_CLASS_NAME } from "./classNames"

/** The catalogue key that says why a renewal was refused. */
const errorKeyOf = (code: string): "errForbidden" | "errCustomPlan" | "errGeneric" => {
    if (code === "BILLING_FORBIDDEN" || code === "BILLING_NOT_MEMBER") return "errForbidden"
    return code === "BILLING_PLAN_CUSTOM" ? "errCustomPlan" : "errGeneric"
}

/** "Gia hạn": asks for a renewal payment order and moves to the QR screen. */
export const RenewButton = ({ workspaceId }: { readonly workspaceId: string }) => {
    const t = useTranslations("billing")
    const router = navigation.useRouter()
    const [error, setError] = useState<string | null>(null)
    const [isPending, start] = useTransition()
    const run = () => {
        setError(null)
        start(async () => {
            const res = await writePaymentOrderRequest({ workspaceId, kind: "renew" })
            if (res.kind === "ok") router.push(`/workspaces/new/payment?ws=${workspaceId}&return=billing`)
            else setError(t(errorKeyOf(res.code)))
        })
    }
    return (
        <div className={RENEW_CLASS_NAME}>
            <Button variant="primary" isPending={isPending} onPress={run}>
                {isPending ? t("renewing") : t("renew")}
            </Button>
            {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
        </div>
    )
}

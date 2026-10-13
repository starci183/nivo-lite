"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import {
    Alert,
    Button,
    Image,
    Input,
    MediaFrame,
    ProgressCircle,
    SectionHeader,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { onboarding } from "@/i18n/dict/onboarding"
import { newOrderAction, orderStatusAction, switchWorkspaceAction } from "./actions"
import { useMoney } from "./useMoney"
import { Stepper } from "./Stepper"
import {
    ACTIONS_CLASS_NAME,
    CENTERED_CLASS_NAME,
    CENTER_CLASS_NAME,
    COPY_CLASS_NAME,
    COUNTDOWN_CLASS_NAME,
    MASCOT_CLASS_NAME,
    PAY_DETAILS_CLASS_NAME,
    PAY_GRID_CLASS_NAME,
    QR_CLASS_NAME,
    QR_WRAP_CLASS_NAME,
    STACK_MD_CLASS_NAME,
} from "./classNames"

/** What the payment screen needs; everything sensitive was decided on the server. */
export type PaymentPanelProps = {
    readonly workspaceId: string
    readonly workspaceName: string
    readonly planName: string
    readonly returnTo: string
    readonly bank: { readonly account: string; readonly bank: string; readonly holder: string }
    /** null when there is no open order (the last one expired). */
    readonly order: {
        readonly id: string
        readonly code: string
        readonly amount: number
        readonly expiresAt: string
        readonly qrUrl: string
    } | null
}

type Phase = "pending" | "paid" | "expired"
const POLL_MS = 3000
const WINDOW_MS = 30 * 60 * 1000

const clock = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000))
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

/** A decorative mascot (allowed in a settled / empty state) inside a plain MediaFrame, so it sits on the card face with no plate. */
const Mascot = ({ src }: { readonly src: string }) => (
    <div className={MASCOT_CLASS_NAME}>
        <MediaFrame treatment="plain" aspect="portrait" fit="contain">
            <Image src={src} alt="" aspect="portrait" fit="contain" plate="none" />
        </MediaFrame>
    </div>
)

/** One transfer detail: read-only and copyable through Grammar's Input. */
const Detail = ({ id, label, value }: { readonly id: string; readonly label: string; readonly value: string }) => {
    const t = useT(onboarding)
    return (
        <Input
            id={id}
            name={id}
            label={label}
            variant="secondary"
            value={value}
            isReadOnly
            isCopyable
            copyLabel={t("copy")}
            copiedLabel={t("copied")}
        />
    )
}

/** Step 3: the VietQR code, copyable bank details, a countdown, and polling until the transfer lands. */
export const PaymentPanel = ({ workspaceId, workspaceName, planName, returnTo, bank, order }: PaymentPanelProps) => {
    const t = useT(onboarding)
    const money = useMoney()
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>(order ? "pending" : "expired")
    const [left, setLeft] = useState<number | null>(order ? new Date(order.expiresAt).getTime() - Date.now() : null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, start] = useTransition()
    const orderId = order?.id
    const expiresAt = order?.expiresAt

    useEffect(() => {
        if (!orderId || !expiresAt || phase !== "pending") return
        const end = new Date(expiresAt).getTime()
        const tick = setInterval(() => {
            const rest = end - Date.now()
            setLeft(rest)
            if (rest <= 0) setPhase("expired")
        }, 1000)
        const poll = setInterval(async () => {
            try {
                const { status } = await orderStatusAction(orderId)
                if (status === "paid") setPhase("paid")
                else if (status === "expired" || status === "cancelled") setPhase("expired")
            } catch {
                // Network blip: the next poll retries.
            }
        }, POLL_MS)
        return () => {
            clearInterval(tick)
            clearInterval(poll)
        }
    }, [orderId, expiresAt, phase])

    useEffect(() => {
        if (phase !== "paid") return
        const go = setTimeout(async () => {
            // The paid workspace becomes the current one before the console opens.
            await switchWorkspaceAction(workspaceId).catch(() => undefined)
            router.push(returnTo)
            router.refresh()
        }, 1800)
        return () => clearTimeout(go)
    }, [phase, returnTo, router, workspaceId])

    const regenerate = () => {
        setError(null)
        start(async () => {
            const res = await newOrderAction(workspaceId)
            if (res.ok) router.refresh()
            else setError(res.error)
        })
    }

    const configured = Boolean(bank.account && bank.bank)
    const steps = [t("stepPlan"), t("stepWorkspace"), t("stepPayment")]

    if (phase === "paid") {
        return (
            <div className={CENTER_CLASS_NAME}>
                <Stepper steps={steps} current={3} label={t("payTitle")} />
                <SurfaceCard ariaLabel={t("paidTitle")}>
                    <div className={CENTERED_CLASS_NAME} role="status">
                        <Mascot src="/images/promo/mascot-celebrate.png" />
                        <SectionHeader level={1} title={t("paidTitle")} description={t("paidText")} />
                        <Button variant="primary" size="lg" href={returnTo}>
                            {t("toWorkspace")}
                        </Button>
                    </div>
                </SurfaceCard>
            </div>
        )
    }

    if (phase === "expired" || !order) {
        return (
            <div className={CENTER_CLASS_NAME}>
                <Stepper steps={steps} current={3} label={t("payTitle")} />
                <SurfaceCard ariaLabel={t("expiredTitle")}>
                    <div className={CENTERED_CLASS_NAME}>
                        <Mascot src="/images/promo/mascot-night.png" />
                        <SectionHeader level={1} title={t("expiredTitle")} description={t("expiredText")} />
                        {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button variant="primary" size="lg" isPending={isPending} onPress={regenerate}>
                                {t("regenerate")}
                            </Button>
                            <Button variant="ghost" href="/workspaces">
                                {t("allWorkspaces")}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        )
    }

    return (
        <div className={CENTER_CLASS_NAME}>
            <Stepper steps={steps} current={3} label={t("payTitle")} />
            <SectionHeader
                level={1}
                title={t("payTitle")}
                description={[workspaceName, planName].filter(Boolean).join(" · ")}
            />
            <SurfaceCard ariaLabel={t("payTitle")}>
                <div className={PAY_GRID_CLASS_NAME}>
                    <div className={QR_WRAP_CLASS_NAME}>
                        <Text size="sm" weight="medium">
                            {t("scanTitle")}
                        </Text>
                        {configured ? (
                            <div className={QR_CLASS_NAME}>
                                <MediaFrame aspect="square" fit="contain">
                                    <Image
                                        src={order.qrUrl}
                                        alt={t("qrAlt")}
                                        width={256}
                                        height={256}
                                        aspect="square"
                                        fit="contain"
                                    />
                                </MediaFrame>
                            </div>
                        ) : (
                            <Alert tone="cautionary" title={t("notConfigured")} />
                        )}
                        {left !== null ? (
                            <div className={COUNTDOWN_CLASS_NAME}>
                                <ProgressCircle
                                    label={t("expiresIn", { time: clock(left) })}
                                    value={Math.round(Math.min(1, Math.max(0, left / WINDOW_MS)) * 100)}
                                />
                                <Text size="sm" tone="muted">
                                    {t("expiresIn", { time: clock(left) })}
                                </Text>
                            </div>
                        ) : null}
                    </div>
                    <div className={PAY_DETAILS_CLASS_NAME}>
                        <div className={COPY_CLASS_NAME}>
                            <Text size="sm" tone="muted">
                                {t("amount")}
                            </Text>
                            <Text size="metric-lead" weight="semibold">
                                {money(order.amount)}
                            </Text>
                        </div>
                        <div className={STACK_MD_CLASS_NAME}>
                            <Detail id="pay-bank" label={t("bank")} value={bank.bank} />
                            <Detail id="pay-account" label={t("account")} value={bank.account} />
                            <Detail id="pay-holder" label={t("holder")} value={bank.holder} />
                            <Detail id="pay-content" label={t("content")} value={order.code} />
                        </div>
                        <Text size="sm" tone="muted">
                            {t("contentWarn")}
                        </Text>
                        <Alert tone="pending" title={t("waiting")} urgency="polite" />
                        <Text size="sm" tone="muted">
                            {t("trust")}
                        </Text>
                    </div>
                </div>
            </SurfaceCard>
        </div>
    )
}

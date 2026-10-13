"use client"

import {
    Badge,
    Button,
    DescriptionList,
    EmptyNotice,
    ListItem,
    PageContainer,
    Region,
    SectionHeader,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { RenewButton } from "@/components/blocks/RenewButton"
import { UsageCard } from "@/components/blocks/UsageCard"
import { useLocale } from "@/i18n/client"
import { intlLocale, TIME_ZONE } from "@/i18n/core"
import type { UsageSummary } from "@/modules/db"
import {
    ACTIONS_CLASS_NAME,
    PAGE_CLASS_NAME,
    ROW_CLASS_NAME,
    ROW_COPY_CLASS_NAME,
    SECTION_CLASS_NAME,
    STACK_CLASS_NAME,
} from "./classNames"

export type BillingOrder = {
    readonly id: string
    readonly amount_vnd: number
    readonly created_at: string
    readonly plan_code: string
    readonly order_code: string
    readonly status: "pending" | "paid" | "expired" | "cancelled"
}
export type BillingReview = {
    readonly id: number
    readonly status: string
    readonly transfer_amount: number | null
    readonly received_at: string
    readonly content: string | null
}
export type BillingPageBaseProps = {
    readonly workspaceId: string
    readonly plan: { readonly name_vi: string; readonly name_en: string; readonly is_custom?: boolean } | null
    readonly status: "pending_payment" | "active" | "past_due" | "cancelled"
    readonly paidUntil: string | null
    readonly orders: ReadonlyArray<BillingOrder>
    readonly review: ReadonlyArray<BillingReview>
    readonly usage: UsageSummary
}

const STATUS_TONE = { active: "success", pending_payment: "warning", past_due: "danger", cancelled: "neutral" } as const
const ORDER_TONE = { paid: "success", pending: "warning", expired: "neutral", cancelled: "neutral" } as const

/** /workspaces/[id]/billing (owner | manager): plan and status, AI usage, payment history, renewal, transfers needing a manual look. */
export const BillingPageBase = ({
    workspaceId: wsId,
    plan,
    status,
    paidUntil,
    orders,
    review,
    usage,
}: BillingPageBaseProps) => {
    const t = useTranslations("billing")
    const locale = useLocale()
    const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TIME_ZONE,
    })
    const day = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeZone: TIME_ZONE })
    const vnd = new Intl.NumberFormat(intlLocale(locale), {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    })
    const money = (n: number | null) => vnd.format(Number(n ?? 0))
    const statusLabel = {
        pending_payment: t("statusPending_payment"),
        active: t("statusActive"),
        past_due: t("statusPast_due"),
        cancelled: t("statusCancelled"),
    }[status]
    const orderLabel = {
        pending: t("orderPending"),
        paid: t("orderPaid"),
        expired: t("orderExpired"),
        cancelled: t("orderCancelled"),
    }
    const reviewLabel: Record<string, string> = {
        underpaid: t("reviewUnderpaid"),
        expired: t("reviewExpired"),
        unmatched: t("reviewUnmatched"),
    }

    return (
        <PageContainer measure="product">
            <div className={PAGE_CLASS_NAME}>
                <div>
                    <Button variant="outline" size="sm" href="/workspaces">
                        {t("allWorkspaces")}
                    </Button>
                </div>
                <SectionHeader level={1} title={t("pageTitle")} description={t("pageText")} />
                <SurfaceCard label={t("currentPlan")} headingLevel={2}>
                    <div className={STACK_CLASS_NAME}>
                        <DescriptionList
                            layout="columns"
                            isDivided
                            items={[
                                {
                                    id: "plan",
                                    term: t("currentPlan"),
                                    description: (
                                        <Text weight="semibold">
                                            {plan ? (locale === "vi" ? plan.name_vi : plan.name_en) : t("noPlan")}
                                        </Text>
                                    ),
                                },
                                {
                                    id: "status",
                                    term: t("status"),
                                    description: (
                                        <Badge tone={STATUS_TONE[status]} isDot>
                                            {statusLabel}
                                        </Badge>
                                    ),
                                },
                                {
                                    id: "paidUntil",
                                    term: t("paidUntil"),
                                    description: (
                                        <Text weight="semibold">
                                            {paidUntil ? day.format(new Date(paidUntil)) : t("notPaid")}
                                        </Text>
                                    ),
                                },
                            ]}
                        />
                        {plan && !plan.is_custom ? (
                            <div className={ACTIONS_CLASS_NAME}>
                                <RenewButton workspaceId={wsId} />
                                <Text size="sm" tone="muted">
                                    {t("renewHint")}
                                </Text>
                            </div>
                        ) : null}
                    </div>
                </SurfaceCard>

                <UsageCard usage={usage} />

                <SurfaceListCard label={t("history")} headingLevel={2} empty={<EmptyNotice message={t("noHistory")} />}>
                    {orders.map((o) => (
                        <ListItem key={o.id} className={ROW_CLASS_NAME}>
                            <div className={ROW_COPY_CLASS_NAME}>
                                <Text weight="medium">{money(o.amount_vnd)}</Text>
                                <Text
                                    size="sm"
                                    tone="muted"
                                >{`${fmt.format(new Date(o.created_at))} · ${o.plan_code} · ${o.order_code}`}</Text>
                            </div>
                            <Badge tone={ORDER_TONE[o.status]}>{orderLabel[o.status]}</Badge>
                        </ListItem>
                    ))}
                </SurfaceListCard>

                <Region labelledBy="billing-review-title" className={SECTION_CLASS_NAME}>
                    <SectionHeader
                        id="billing-review-title"
                        level={2}
                        title={t("review")}
                        description={t("reviewText")}
                    />
                    <SurfaceListCard ariaLabel={t("review")} empty={<EmptyNotice message={t("noReview")} />}>
                        {review.map((r) => (
                            <ListItem key={r.id} className={ROW_CLASS_NAME}>
                                <div className={ROW_COPY_CLASS_NAME}>
                                    <Text weight="medium">{reviewLabel[r.status] ?? r.status}</Text>
                                    <Text size="sm" tone="muted">
                                        {t("reviewReceived", {
                                            amount: money(r.transfer_amount),
                                            date: fmt.format(new Date(r.received_at)),
                                        })}
                                    </Text>
                                    {r.content ? (
                                        <Text size="sm">
                                            <code>{r.content}</code>
                                        </Text>
                                    ) : null}
                                </div>
                            </ListItem>
                        ))}
                    </SurfaceListCard>
                </Region>
            </div>
        </PageContainer>
    )
}

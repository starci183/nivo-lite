"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { LoyaltyFiguresBase } from "./component"

const stateOf = (failed: boolean, loaded: boolean): "loading" | "failed" | "ready" => {
    if (failed) return "failed"
    return loaded ? "ready" : "loading"
}

/** The connected figures strip of the loyalty workbench: active members, points issued, redemptions and members at risk. */
export const LoyaltyFigures = () => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const { data, error } = useQueryLoyaltyBoardSwr()
    const f = data?.figures
    const state = stateOf(error !== undefined, f !== undefined)
    return (
        <LoyaltyFiguresBase
            props={{
                label: t("metricsAria"),
                state,
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
                items:
                    f === undefined
                        ? []
                        : [
                              {
                                  id: "active",
                                  term: t("metricMembers"),
                                  description: format.number(f.activeMembers),
                                  meta: t("metricMembersBasis", { n: format.number(f.members) }),
                              },
                              {
                                  id: "issued",
                                  term: t("metricIssued"),
                                  description: t("points", { n: format.number(f.pointsIssued30d) }),
                                  meta: t("metricIssuedBasis"),
                              },
                              {
                                  id: "redemptions",
                                  term: t("metricRedemptions"),
                                  description: format.number(f.redemptions30d),
                                  meta: t("metricRedemptionsBasis", { n: format.number(f.pointsRedeemed30d) }),
                              },
                              {
                                  id: "atRisk",
                                  term: t("metricAtRisk"),
                                  description: format.number(f.atRisk),
                                  meta: t("metricAtRiskBasis"),
                              },
                          ],
            }}
        />
    )
}

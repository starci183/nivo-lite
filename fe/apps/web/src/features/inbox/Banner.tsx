"use client"

import { Alert } from "@starci/grammar/common"

/** Props for {@link Banner}. */
export type BannerProps = { readonly title: string; readonly description: string; readonly tone: "negative" | "cautionary" }

/** Client wrapper for the grammar Alert (Alert keeps state, so server pages cannot render it directly). */
export const Banner = ({ title, description, tone }: BannerProps) => <Alert title={title} description={description} tone={tone} />

import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import { MetaError, MetaErrorCode } from "./errors/meta.error"
import { MetaMessagingClient } from "./meta-messaging.client"
import type { MetaPageCredentials } from "./meta.contracts"
import type { PageInsightsDay, ScheduledPagePost, ScheduledPagePostResult } from "./meta-publishing.contracts"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const rowsOf = (value: unknown): ReadonlyArray<Json> => (Array.isArray(value) ? value.filter(isJson) : [])

const idOf = (body: Json): string => {
    const id = body.id
    if (typeof id !== "string" || id === "") throw new MetaError({ code: MetaErrorCode.ContractMismatch })
    return id
}

/** The reach and engagement metrics of the Page insights edge. */
export const INSIGHT_METRICS = {
    reach: "page_impressions_unique",
    engagements: "page_post_engagements",
} as const

/** The earliest Meta accepts a scheduled post: ten minutes ahead (with one minute of margin). */
const MIN_LEAD_SECONDS = 11 * 60

/** The day of a Meta `end_time` (the value covers the day before the end time). */
const dayOf = (endTime: string): string => {
    const end = new Date(endTime)
    end.setUTCDate(end.getUTCDate() - 1)
    return end.toISOString().slice(0, 10)
}

const numberOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0)

@Injectable()
/** Schedules Page posts (published=false with scheduled_publish_time) and reads the daily Page insights. */
export class MetaPublishingClient extends MetaMessagingClient {
    /**
     * Uploads each image as an unpublished photo, then creates the unpublished post that Meta publishes at `publishAt`. A publish
     * moment closer than ten minutes is moved to the earliest moment Meta accepts.
     */
    async schedulePagePost(page: MetaPageCredentials, post: ScheduledPagePost): Promise<ScheduledPagePostResult> {
        const earliest = Math.ceil(this.clock.now().getTime() / 1000) + MIN_LEAD_SECONDS
        const scheduledPublishTime = Math.max(Math.floor(post.publishAt.getTime() / 1000), earliest)
        const photoIds: Array<string> = []
        await eachInOrder(post.imageUrls, async (url) => {
            const photo = await this.graph(`${page.pageId}/photos`, {
                token: page.pageToken,
                method: "POST",
                params: { url, published: false, temporary: true },
            })
            photoIds.push(idOf(photo))
        })
        const feed = await this.graph(`${page.pageId}/feed`, {
            token: page.pageToken,
            method: "POST",
            body: {
                message: post.message,
                published: false,
                scheduled_publish_time: scheduledPublishTime,
                ...(photoIds.length === 0 ? {} : { attached_media: photoIds.map((id) => ({ media_fbid: id })) }),
            },
        })
        return { postId: idOf(feed), photoIds, scheduledPublishTime }
    }

    /** The daily reach and engagements of the Page between two days (inclusive `since`, exclusive `until`), oldest first. */
    async pageInsights(
        page: MetaPageCredentials,
        since: string,
        until: string,
    ): Promise<ReadonlyArray<PageInsightsDay>> {
        const body = await this.graph(`${page.pageId}/insights`, {
            token: page.pageToken,
            params: {
                metric: `${INSIGHT_METRICS.reach},${INSIGHT_METRICS.engagements}`,
                period: "day",
                since,
                until,
            },
        })
        const days = new Map<string, { reach: number; engagements: number }>()
        for (const metric of rowsOf(body.data)) {
            if (metric.name !== INSIGHT_METRICS.reach && metric.name !== INSIGHT_METRICS.engagements) continue
            const key = metric.name === INSIGHT_METRICS.reach ? "reach" : "engagements"
            for (const value of rowsOf(metric.values)) {
                if (typeof value.end_time !== "string") continue
                const day = dayOf(value.end_time)
                const current = days.get(day) ?? { reach: 0, engagements: 0 }
                days.set(day, { ...current, [key]: numberOf(value.value) })
            }
        }
        return [...days.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, counts]) => ({ day, reach: counts.reach, engagements: counts.engagements }))
    }
}

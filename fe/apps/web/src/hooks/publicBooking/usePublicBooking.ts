"use client"

import { useRef, useState, useTransition } from "react"
import { useMutateRequestPublicBookingSwr, useQueryPublicBookingTimesSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/api"
import type { PublicBookingPageData } from "@/modules/types"
import { newIdempotencyToken } from "@/modules/utils"
import { bookingStateOf, publicCodeOf, timesOf } from "./publicBooking.shared"
import type { PublicBookingResult } from "./publicBooking.shared"

/** The fields of the form, in the order the visitor fills them. */
export interface PublicBookingFields {
    readonly serviceId: string
    readonly date: string
    readonly start: string
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly party: number
    readonly note: string
    readonly website: string
}

/** The visitor's booking form: free times follow the service, day and party through SWR, and a send turns into a result the page shows. */
export const usePublicBooking = (page: PublicBookingPageData, today: string) => {
    const [fields, setFields] = useState<PublicBookingFields>({
        serviceId: page.services[0]?.id ?? "",
        date: today,
        start: "",
        name: "",
        phone: "",
        email: "",
        party: 1,
        note: "",
        website: "",
    })
    const [result, setResult] = useState<PublicBookingResult | null>(null)
    const [isBusy, startTransition] = useTransition()
    const token = useRef(newIdempotencyToken())
    const request = useMutateRequestPublicBookingSwr()
    const timesQuery = useQueryPublicBookingTimesSwr(
        fields.serviceId === ""
            ? null
            : { slug: page.slug, serviceId: fields.serviceId, date: fields.date, party: fields.party },
    )
    const times = timesOf(timesQuery.data, timesQuery.error)

    const submit = () =>
        startTransition(async () => {
            setResult(null)
            try {
                const answer = await request.trigger({
                    slug: page.slug,
                    serviceId: fields.serviceId,
                    start: fields.start,
                    name: fields.name,
                    phone: fields.phone,
                    email: fields.email === "" ? null : fields.email,
                    party: fields.party,
                    note: fields.note === "" ? null : fields.note,
                    token: token.current,
                    website: fields.website === "" ? null : fields.website,
                })
                setResult({
                    kind: "answered",
                    answer: {
                        ok: answer.state === "confirmed" || answer.state === "waiting",
                        state: bookingStateOf(answer.state),
                        code: answer.code,
                        service: answer.serviceName,
                        start: answer.startIso,
                        alternatives: answer.alternatives,
                        bookingId: answer.bookingId ?? null,
                    },
                })
                if (answer.state === "confirmed") token.current = newIdempotencyToken()
            } catch (error) {
                const code = graphQLErrorCode(error)
                if (code === undefined) return setResult({ kind: "failed", code: "offline" })
                const mapped = publicCodeOf(code)
                if (mapped === undefined) return setResult({ kind: "failed", code: "failed" })
                setResult({
                    kind: "answered",
                    answer: {
                        ok: false,
                        state: "invalid",
                        code: mapped,
                        service: "",
                        start: "",
                        alternatives: [],
                        bookingId: null,
                    },
                })
            }
        })

    return {
        fields,
        times,
        result,
        isBusy,
        change: (patch: Partial<PublicBookingFields>) =>
            setFields((before) => ({
                ...before,
                ...patch,
                ...("serviceId" in patch || "date" in patch || "party" in patch ? { start: "" } : {}),
            })),
        submit,
        again: () => {
            setResult(null)
            setFields((before) => ({ ...before, start: "" }))
            token.current = newIdempotencyToken()
        },
        pick: (isoStart: string, day: string) => {
            setResult(null)
            setFields((before) => ({ ...before, date: day, start: isoStart }))
        },
    }
}

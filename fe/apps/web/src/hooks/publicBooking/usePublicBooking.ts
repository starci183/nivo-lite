"use client"

import { useRef, useState, useTransition } from "react"
import { useMutateRequestPublicBookingSwr, useQueryPublicBookingTimesSwr } from "@/hooks/swr/api/graphql"
import { graphQLErrorCode } from "@/modules/api/graphql/errors"
import type { PublicBookingPage } from "@/modules/types"
import { PUBLIC_CODE_OF_ERROR, newToken } from "./publicBooking.shared"
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
export const usePublicBooking = (page: PublicBookingPage, today: string) => {
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
    const token = useRef(newToken())
    const request = useMutateRequestPublicBookingSwr()
    const timesQuery = useQueryPublicBookingTimesSwr(
        fields.serviceId === ""
            ? null
            : { slug: page.slug, serviceId: fields.serviceId, date: fields.date, party: fields.party },
    )
    const times = timesQuery.data === undefined ? (timesQuery.error === undefined ? null : []) : timesQuery.data.times

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
                        state: answer.state as "confirmed" | "waiting" | "invalid" | "failed",
                        code: answer.code,
                        service: answer.serviceName,
                        start: answer.startIso,
                        alternatives: answer.alternatives,
                        bookingId: answer.bookingId ?? null,
                    },
                })
                if (answer.state === "confirmed") token.current = newToken()
            } catch (error) {
                const code = graphQLErrorCode(error)
                if (code === undefined) return setResult({ kind: "failed", code: "offline" })
                const mapped = PUBLIC_CODE_OF_ERROR[code]
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
            token.current = newToken()
        },
        pick: (isoStart: string, day: string) => {
            setResult(null)
            setFields((before) => ({ ...before, date: day, start: isoStart }))
        },
    }
}

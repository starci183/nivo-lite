"use client"

import { useMutateRequestPublicBookingSwr, useQueryPublicBookingTimesSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/failure"
import type { PublicBookingPageData } from "@/modules/types"
import { wallDate } from "@/modules/i18n"
import { newIdempotencyToken } from "@/modules/utils"
import { useState, type Dispatch, type SetStateAction } from "react"

import { bookingStateOf, publicCodeOf, timesOf, type PublicBookingResult } from "./publicBooking.shared"

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

/** State belonging to one mounted shop form, including its request generation. */
interface BookingSession {
    readonly slug: string | null
    readonly generation: number
    readonly today: string
    readonly fields: PublicBookingFields
    readonly result: PublicBookingResult | null
    readonly isBusy: boolean
    readonly token: string
}

/** The visitor's booking state starts when shop data arrives and resets with the mounted shop. */
export const usePublicBooking = (page: PublicBookingPageData | null | undefined) => {
    const [session, setSession] = useState(() => sessionOf(page, 0))
    const { fields, today, result, isBusy } = session
    if (session.slug !== (page?.slug ?? null)) {
        setSession(sessionOf(page, session.generation + 1))
    }
    const request = useMutateRequestPublicBookingSwr()
    const timesQuery = useQueryPublicBookingTimesSwr(
        page?.slug === undefined || session.slug !== page.slug || fields.serviceId === ""
            ? null
            : { slug: page.slug, serviceId: fields.serviceId, date: fields.date, party: fields.party },
    )
    const update = (change: (current: BookingSession) => BookingSession) =>
        setSession((current) => (current.generation === session.generation ? change(current) : current))
    const submit = () => {
        if (page == null) return
        update((current) => ({ ...current, result: null, isBusy: true }))
        void request.trigger(requestInputOf(page.slug, session)).then(
            (answer) =>
                update((current) => ({
                    ...current,
                    result: answeredBookingOf(answer),
                    isBusy: false,
                    token: answer.state === "confirmed" ? newIdempotencyToken() : current.token,
                })),
            (error: unknown) => update((current) => ({ ...current, result: failedBookingOf(error), isBusy: false })),
        )
    }
    return {
        today,
        fields,
        times: timesOf(timesQuery.data, timesQuery.error),
        result,
        isBusy,
        submit,
        ...bookingEditsOf(setSession),
    }
}

/** A mutation uses the visitor's fields and token from the submitted render. */
const requestInputOf = (slug: string, session: BookingSession) => ({
    slug,
    serviceId: session.fields.serviceId,
    start: session.fields.start,
    name: session.fields.name,
    phone: session.fields.phone,
    email: session.fields.email === "" ? null : session.fields.email,
    party: session.fields.party,
    note: session.fields.note === "" ? null : session.fields.note,
    token: session.token,
    website: session.fields.website === "" ? null : session.fields.website,
})

/** A missing transport code is offline; known refusal codes retain their existing messages. */
const failedBookingOf = (error: unknown): PublicBookingResult => {
    const code = graphQLErrorCode(error)
    if (code === undefined) return { kind: "failed", code: "offline" }
    const mapped = publicCodeOf(code)
    return mapped === undefined ? { kind: "failed", code: "failed" } : refusedBookingOf(mapped)
}

const refusedBookingOf = (mapped: string): PublicBookingResult => {
    return {
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
    }
}

const answeredBookingOf = (answer: AnswerInput1): PublicBookingResult => {
    return {
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
    }
}

type AnswerInput1 = {
    alternatives: Array<string>
    bookingId: string | null
    code: string
    serviceName: string
    startIso: string
    state: string
}

/** Initial values are populated only once the shop is available. */
const sessionOf = (page: PublicBookingPageData | null | undefined, generation: number): BookingSession => {
    const today = page == null ? "" : wallDate(Date.now(), page.timezone)
    return {
        slug: page?.slug ?? null,
        generation,
        today,
        fields: {
            serviceId: page?.services[0]?.id ?? "",
            date: today,
            start: "",
            name: "",
            phone: "",
            email: "",
            party: 1,
            note: "",
            website: "",
        },
        result: null,
        isBusy: false,
        token: newIdempotencyToken(),
    }
}

/** Editing commands preserve the request token until the visitor starts a new attempt. */
const bookingEditsOf = (setSession: Dispatch<SetStateAction<BookingSession>>) => ({
    change: (patch: Partial<PublicBookingFields>) =>
        setSession((current) => ({
            ...current,
            fields: {
                ...current.fields,
                ...patch,
                ...("serviceId" in patch || "date" in patch || "party" in patch ? { start: "" } : {}),
            },
        })),
    again: () =>
        setSession((current) => ({
            ...current,
            result: null,
            fields: { ...current.fields, start: "" },
            token: newIdempotencyToken(),
        })),
    pick: (start: string, date: string) =>
        setSession((current) => ({
            ...current,
            result: null,
            fields: { ...current.fields, date, start },
        })),
})

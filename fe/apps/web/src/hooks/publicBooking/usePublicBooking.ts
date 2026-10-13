import { useEffect, useRef, useState, useTransition } from "react"
import type { PublicBookingAnswer, PublicBookingInput, PublicBookingPage } from "@/modules/types"
import { newToken } from "./publicBooking.shared"
import type { PublicBookingResult } from "./publicBooking.shared"

type Outcome<T> =
    | { readonly kind: "ok"; readonly value: T }
    | { readonly kind: "refused" | "not-found" | "invalid" | "unavailable"; readonly code: string }

/** The two calls the page makes; the connected block owns the server actions and hands them in. */
export interface PublicBookingActions {
    readonly times: (serviceId: string, date: string, party: number) => Promise<Outcome<ReadonlyArray<string>>>
    readonly request: (input: PublicBookingInput) => Promise<Outcome<PublicBookingAnswer>>
}

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

/** The visitor's booking form: free times follow the service, day and party, and a send turns into a result the page shows. */
export const usePublicBooking = (page: PublicBookingPage, today: string, actions: PublicBookingActions) => {
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
    const [times, setTimes] = useState<ReadonlyArray<string> | null>(null)
    const [result, setResult] = useState<PublicBookingResult | null>(null)
    const [isBusy, startTransition] = useTransition()
    const token = useRef(newToken())
    const { serviceId, date, party } = fields

    useEffect(() => {
        if (serviceId === "") return
        let current = true
        setTimes(null)
        setFields((before) => ({ ...before, start: "" }))
        actions
            .times(serviceId, date, party)
            .then((answer) => {
                if (current) setTimes(answer.kind === "ok" ? answer.value : [])
            })
            .catch(() => {
                if (current) setTimes([])
            })
        return () => {
            current = false
        }
    }, [actions, serviceId, date, party])

    const submit = () =>
        startTransition(async () => {
            setResult(null)
            try {
                const answer = await actions.request({
                    slug: page.slug,
                    serviceId: fields.serviceId,
                    start: fields.start,
                    name: fields.name,
                    phone: fields.phone,
                    email: fields.email,
                    party: fields.party,
                    note: fields.note,
                    token: token.current,
                    website: fields.website,
                })
                if (answer.kind !== "ok") return setResult({ kind: "failed", code: "failed" })
                setResult({ kind: "answered", answer: answer.value })
                if (answer.value.state === "confirmed") token.current = newToken()
            } catch {
                setResult({ kind: "failed", code: "offline" })
            }
        })

    return {
        fields,
        times,
        result,
        isBusy,
        change: (patch: Partial<PublicBookingFields>) => setFields((before) => ({ ...before, ...patch })),
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

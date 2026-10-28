export { PublicBookingForm } from "./component"

/** The fields of the form. */
interface PublicBookingFieldValues {
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

/** A nearby free time the visitor can take instead. */
interface PublicBookingAlternative {
    readonly value: string
    readonly label: string
    readonly date: string
}

/** A resolved option in the service or time selector. */
interface PublicBookingOption {
    readonly value: string
    readonly label: string
}

/** A service with its duration and price description. */
interface PublicBookingServiceOption extends PublicBookingOption {
    readonly description: string
}

/** The labels of the public form. */
interface PublicBookingLabels {
    readonly step1: string
    readonly step2: string
    readonly step3: string
    readonly finding: string
    readonly noTimes: string
    readonly pickTime: string
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly party: string
    readonly note: string
    readonly website: string
    readonly submit: string
    readonly footnote: string
    readonly again: string
    readonly alternatives: string
}

/** A server answer displayed with alternative times. */
interface PublicBookingFeedback {
    readonly message: string
    readonly alternatives: ReadonlyArray<PublicBookingAlternative>
}

/** A successful answer replaces the form. */
interface PublicBookingDone extends PublicBookingFeedback {
    readonly title: string
}

/** Resolved form values and display state. */
interface PublicBookingView {
    readonly formLabel: string
    readonly fields: PublicBookingFieldValues
    readonly services: ReadonlyArray<PublicBookingServiceOption>
    readonly noServicesText: string
    readonly days: ReadonlyArray<PublicBookingOption>
    /** Null while the free times load. */
    readonly times: ReadonlyArray<PublicBookingOption> | null
    readonly labels: PublicBookingLabels
    readonly isBusy: boolean
    readonly done?: PublicBookingDone
    /** The answer that turned the booking down, with nearby free times. */
    readonly refusal?: PublicBookingFeedback
}

/** Commands supplied by the connected booking owner. */
interface PublicBookingActions {
    readonly change: (patch: Partial<PublicBookingFieldValues>) => void
    readonly submit: () => void
    readonly again: () => void
    readonly pickAlternative: (start: string, date: string) => void
}

/** Props for {@link PublicBookingForm}. */
export interface PublicBookingFormProps {
    readonly props: PublicBookingView
    readonly on: PublicBookingActions
}

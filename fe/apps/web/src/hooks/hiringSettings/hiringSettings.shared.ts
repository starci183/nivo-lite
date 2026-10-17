import type { HiringSettingsType, SaveHiringSettingsRequest } from "@/hooks/swr"

/** The values of the settings form. */
export interface SettingsValues {
    publicSlug: string
    retentionDays: number
    applyConsentText: string
    adTone: string
    notifyNewCandidate: boolean
    remindInterview: boolean
    autoCloseWhenFilled: boolean
}

/** Candidate files are kept for at least this many days after a rejection or a withdrawal. */
export const RETENTION_MIN_DAYS = 7

/** ... and at most this many. */
export const RETENTION_MAX_DAYS = 730

/** The form values of the stored settings. */
export const settingsDefaults = (settings: HiringSettingsType): SettingsValues => ({
    publicSlug: settings.publicSlug,
    retentionDays: settings.retentionDays,
    applyConsentText: settings.applyConsentText,
    adTone: settings.adTone,
    notifyNewCandidate: settings.notifyNewCandidate,
    remindInterview: settings.remindInterview,
    autoCloseWhenFilled: settings.autoCloseWhenFilled,
})

/** The `saveHiringSettings` input of the form values. */
export const toSettingsInput = (values: SettingsValues): SaveHiringSettingsRequest => ({ ...values })

/** One field of the form: a select (it has options) or a text input (it has none). */
interface ShiftsFieldView {
    readonly control?: "input" | "select"
    readonly id: string
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** One row of the list under the form: its text, then a state badge or an action button. */
interface ShiftsFormRowView {
    readonly id: string
    readonly text: string
    readonly badge: { readonly tone: "success" | "neutral" | "warning"; readonly label: string } | null
    readonly actionLabel: string | null
}

/** What the form card shows. */
interface FormCardView {
    /** Fixed controls and resolved labels, also used while the region awaits its first values. */
    readonly fieldStructure?: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly control: "input" | "select"
    }>
    readonly title: string
    readonly hint: string
    readonly fields: ReadonlyArray<ShiftsFieldView>
    /** The wording of the switch for its current state, or `null` when the form has none. */
    readonly switchLabel: string | null
    readonly switchOn: boolean
    readonly submitLabel: string
    readonly submitIntent: "commit" | "neutral"
    readonly isBusy: boolean
    readonly canSubmit: boolean
    readonly rows: ReadonlyArray<ShiftsFormRowView>
}

/** One position with its colour. */
interface PositionsPositionView {
    readonly id: string
    readonly label: string
    readonly color: string
}

/** What is typed in the staff form. */
interface StaffStaffForm {
    /** The person being edited, or `null` for a new one. */
    readonly id: string | null
    readonly name: string
    readonly positionIds: ReadonlyArray<string>
    readonly wage: number
    readonly maxWeek: number
    readonly maxDay: number
    readonly minRest: number
    readonly staffRowId: string | null
    readonly phone: string
    readonly telegramChatId: string
    readonly zaloUserId: string
    readonly active: boolean
}

/** The text fields of the staff form. */
type StaffStaffTextField = "name" | "phone" | "telegramChatId" | "zaloUserId"

/** The number fields of the staff form. */
type StaffStaffNumberField = "wage" | "maxWeek" | "maxDay" | "minRest"

/** What is typed in the coverage form. */
interface DemandDemandForm {
    readonly days: ReadonlyArray<string>
    readonly start: string
    readonly end: string
    readonly positionId: string
    readonly min: number
    readonly ideal: number
    readonly peak: boolean
}

/** One select choice. */
interface DemandOptionView {
    readonly id: string
    readonly label: string
}

/** The coverage blocks of one weekday. */
interface DemandDemandGroupView {
    readonly id: string
    readonly label: string
    readonly blocks: ReadonlyArray<DemandOptionView>
}

/** The numeric rules of the shop. */
type RulesRuleField = "swap" | "leave" | "remind" | "noshow" | "overtime"

/** One select choice. */
interface RulesOptionView {
    readonly id: string
    readonly label: string
}

/** The three lists a manager can type. */
type QuickImportImportField = "positions" | "staff" | "coverage"

/** What is typed in the three lists. */
interface QuickImportImportForm {
    readonly positions: string
    readonly staff: string
    readonly coverage: string
}

/** Actual resolved setup drawings, shared by the world controller and pure ready anatomy. */
export interface ShiftsSetupViews {
    readonly quickReady: {
        readonly isVisible: boolean
        readonly quickImport: ShiftsSetupViews["quickImportData"] | undefined
    }
    readonly quickCopy: { readonly quickImport: ShiftsSetupViews["quickImportCopy"] }

    readonly setupReady: {
        readonly isVisible: boolean
        readonly positions: ShiftsSetupViews["positionsData"] | undefined
        readonly staff: ShiftsSetupViews["staffData"] | undefined
        readonly demand: ShiftsSetupViews["demandData"] | undefined
        readonly availability: ShiftsSetupViews["availabilityData"] | undefined
        readonly rules: ShiftsSetupViews["rulesData"] | undefined
    }
    readonly setupCopy: {
        readonly positions: ShiftsSetupViews["positionsCopy"]
        readonly staff: ShiftsSetupViews["staffCopy"]
        readonly demand: ShiftsSetupViews["demandCopy"]
        readonly availability: ShiftsSetupViews["availabilityCopy"]
        readonly rules: ShiftsSetupViews["rulesCopy"]
    }

    readonly positionsData: Pick<ShiftsSetupViews["positions"], "positions">
    readonly positionsCopy: Omit<ShiftsSetupViews["positions"], "positions">

    readonly staffData: Pick<ShiftsSetupViews["staff"], "people" | "positionOptions" | "linkOptions">
    readonly staffCopy: Omit<ShiftsSetupViews["staff"], "people" | "positionOptions" | "linkOptions">

    readonly demandData: Pick<
        ShiftsSetupViews["demand"],
        "groups" | "positionOptions" | "form" | "hasBlocks" | "canAdd"
    >
    readonly demandCopy: Omit<
        ShiftsSetupViews["demand"],
        "groups" | "positionOptions" | "form" | "hasBlocks" | "canAdd"
    >

    readonly availabilityData: Pick<ShiftsSetupViews["availability"], "fields" | "rows" | "canSubmit">
    readonly availabilityCopy: Omit<ShiftsSetupViews["availability"], "fields" | "rows" | "canSubmit">

    readonly rulesData: Pick<
        ShiftsSetupViews["rules"],
        "reminderLabel" | "reminderHint" | "reminderOn" | "fields" | "days"
    >
    readonly rulesCopy: Omit<
        ShiftsSetupViews["rules"],
        "reminderLabel" | "reminderHint" | "reminderOn" | "fields" | "days"
    >

    readonly quickImportData: Pick<ShiftsSetupViews["quickImport"], never>
    readonly quickImportCopy: Omit<ShiftsSetupViews["quickImport"], never>

    readonly positions: {
        readonly title: string
        readonly hint: string
        readonly emptyLabel: string
        readonly nameLabel: string
        readonly addLabel: string
        readonly removeLabel: string
        readonly positions: ReadonlyArray<PositionsPositionView>
        readonly name: string
        readonly isBusy: boolean
        readonly canAdd: boolean
    }
    readonly positionsPositionView: PositionsPositionView
    readonly staff: {
        readonly title: string
        readonly hint: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly editLabel: string
        readonly formTitle: string
        readonly saveLabel: string
        readonly cancelLabel: string
        readonly labels: {
            readonly name: string
            readonly wage: string
            readonly maxWeek: string
            readonly maxDay: string
            readonly minRest: string
            readonly phone: string
            readonly telegram: string
            readonly zalo: string
            readonly link: string
            readonly positions: string
            readonly active: string
        }
        readonly people: ReadonlyArray<{
            readonly id: string
            readonly title: string
            readonly notes: ReadonlyArray<string>
        }>
        readonly form: StaffStaffForm
        readonly positionOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly linkOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        /** The id of the "not linked" choice of the link select. */
        readonly noLinkId: string
        readonly isBusy: boolean
        readonly canSave: boolean
    }
    readonly staffStaffForm: StaffStaffForm
    readonly staffStaffTextField: StaffStaffTextField
    readonly staffStaffNumberField: StaffStaffNumberField
    readonly demand: {
        readonly title: string
        readonly hint: string
        readonly emptyLabel: string
        readonly addTitle: string
        readonly addLabel: string
        readonly removeLabel: string
        readonly labels: {
            readonly days: string
            readonly from: string
            readonly to: string
            readonly position: string
            readonly min: string
            readonly ideal: string
            readonly peak: string
        }
        readonly groups: ReadonlyArray<DemandDemandGroupView>
        readonly dayOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly timeOptions: ReadonlyArray<DemandOptionView>
        readonly positionOptions: ReadonlyArray<DemandOptionView>
        readonly form: DemandDemandForm
        readonly hasBlocks: boolean
        readonly isBusy: boolean
        readonly canAdd: boolean
    }
    readonly demandDemandForm: DemandDemandForm
    readonly demandOptionView: DemandOptionView
    readonly demandDemandGroupView: DemandDemandGroupView
    readonly availability: FormCardView
    readonly rules: {
        readonly fieldStructure: ReadonlyArray<{
            readonly id: RulesRuleField
            readonly label: string
            readonly min: number
            readonly max: number
        }>
        readonly dayStructure: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly openingLabel: string
        readonly closingLabel: string
        readonly title: string
        readonly hint: string
        readonly hoursTitle: string
        readonly closedLabel: string
        readonly saveLabel: string
        readonly reminderLabel: string
        /** Why reminders are off, or empty when they are on. */
        readonly reminderHint: string
        readonly reminderOn: boolean
        readonly fields: ReadonlyArray<{
            readonly id: RulesRuleField
            readonly label: string
            readonly value: number
            readonly min: number
            readonly max: number
        }>
        readonly days: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly isOpen: boolean
            /** The opening and the closing time with their labels. */
            readonly ends: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: string }>
        }>
        readonly timeOptions: ReadonlyArray<RulesOptionView>
        readonly isBusy: boolean
    }
    readonly rulesRuleField: RulesRuleField
    readonly rulesOptionView: RulesOptionView
    readonly quickImport: {
        readonly title: string
        readonly hint: string
        readonly createLabel: string
        readonly fields: ReadonlyArray<{
            readonly id: QuickImportImportField
            readonly label: string
            readonly hint: string
            readonly placeholder: string
            readonly rows: number
        }>
        readonly form: QuickImportImportForm
        readonly isBusy: boolean
        readonly canCreate: boolean
    }
    readonly quickImportImportField: QuickImportImportField
    readonly quickImportImportForm: QuickImportImportForm
    readonly formCard: FormCardView
    readonly formField: ShiftsFieldView
}

/** Commands stay separate from the resolved setup data contract. */
export interface ShiftsSetupActions {
    readonly positions: {
        readonly name: (value: string) => void
        readonly add: () => void
        readonly remove: (id: string) => void
    }
    readonly staff: {
        readonly edit: (id: string) => void
        readonly text: (field: StaffStaffTextField, value: string) => void
        readonly number: (field: StaffStaffNumberField, value: number) => void
        readonly positions: (ids: Array<string>) => void
        readonly link: (id: string) => void
        readonly active: (value: boolean) => void
        readonly save: () => void
        readonly cancel: () => void
    }
    readonly demand: {
        readonly days: (days: Array<string>) => void
        readonly start: (value: string) => void
        readonly end: (value: string) => void
        readonly position: (id: string) => void
        readonly min: (value: number) => void
        readonly ideal: (value: number) => void
        readonly peak: (value: boolean) => void
        readonly add: () => void
        readonly remove: (id: string) => void
    }
    readonly availability: {
        readonly field: (id: string, value: string) => void
        readonly available: (value: boolean) => void
        readonly submit: () => void
        readonly remove: (id: string) => void
    }
    readonly rules: {
        readonly rule: (field: RulesRuleField, value: number) => void
        readonly toggle: (day: string, isOpen: boolean) => void
        readonly end: (day: string, end: string, value: string) => void
        readonly save: () => void
    }
    readonly quickImport: {
        readonly change: (field: QuickImportImportField, value: string) => void
        readonly create: () => void
    }
}

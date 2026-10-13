/** The HTTP response of setWorkspacePlan. */
export class SetWorkspacePlanResponse {
    /** The plan now set. */
    planCode!: string

    /** The own allowance now set. */
    creditsLimit!: number | null
}

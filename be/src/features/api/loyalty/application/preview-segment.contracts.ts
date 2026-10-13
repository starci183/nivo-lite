/** The segment of preview segment, as a named part. */
export interface PreviewSegmentSegmentRequest {
    /** The tiers. */
    readonly tiers: ReadonlyArray<string>
    /** The inactive days. */
    readonly inactiveDays: number
    /** The birthday this month. */
    readonly birthdayThisMonth: boolean
    /** The min spend vnd. */
    readonly minSpendVnd: number
}

/** What preview-segment takes. */
export interface PreviewSegmentRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The segment. */
    readonly segment: PreviewSegmentSegmentRequest
}

/** The sample of preview segment, as a named part. */
export interface PreviewSegmentSampleResult {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The tier key. */
    readonly tierKey: string | null
}

/** What preview-segment answers. */
export interface PreviewSegmentResult {
    /** The total. */
    readonly total: number
    /** The reachable. */
    readonly reachable: number
    /** The sample. */
    readonly sample: ReadonlyArray<PreviewSegmentSampleResult>
}

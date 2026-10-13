/** The title of an authority action in both product languages. */
export interface AuthorityActionLabel {
    /** The Vietnamese title. */
    readonly vi: string
    /** The English title. */
    readonly en: string
}

/** One authority action row as the catalogue mirror writes it. */
export interface AuthorityActionRecord {
    /** The stable action key, unique across every module. */
    readonly action: string
    /** The module that owns the action. */
    readonly module_key: string
    /** The position of the action inside its module. */
    readonly sort_order: number
    /** The default authority mode. */
    readonly default_mode: "auto" | "ask" | "never"
    /** The default amount limit in VND, when one applies. */
    readonly default_limit_vnd: number | null
    /** The fields a request for the action must carry. */
    readonly default_required_fields: ReadonlyArray<string>
    /** Whether an amount limit is meaningful for the action. */
    readonly amount_limit: boolean
    /** The loosest mode the action can ever take: set means it can never run alone. */
    readonly max_mode: "ask" | "never" | null
    /** The action title in both languages. */
    readonly label: AuthorityActionLabel
}

/** What an authority action sync did. */
export interface AuthorityActionsSyncReport {
    /** How many action rows were upserted. */
    readonly written: number
    /** The action keys the database holds that the sync did not write; they are reported, never deleted. */
    readonly stale: ReadonlyArray<string>
}

/** The first event a connection accepted. */
export class FirstEventBody {
    /** The amount of the event. */
    amount!: number
    /** The content of the event. */
    content!: string
    /** When it arrived, ISO 8601. */
    at!: string
    /** An optional readable line. */
    text?: string
}

/** One Page waiting for the choice. */
export class MetaPageOptionBody {
    /** The Page id. */
    id!: string
    /** The Page name. */
    name!: string
    /** The Page category. */
    category!: string
    /** The linked Instagram account id. */
    igId!: string
    /** The linked Instagram username. */
    igUsername!: string
}

/** The HTTP response of the ChooseMetaPage operation. */
export class ChooseMetaPageResponse {
    /** The id. */
    id!: string
    /** The name. */
    name!: string
    /** The status. */
    status!: string
    /** The configured. */
    configured!: boolean
    /** The pages. */
    pages!: MetaPageOptionBody[]
    /** The pageId. */
    pageId!: string
    /** The pageName. */
    pageName!: string
    /** The igId. */
    igId!: string
    /** The igUsername. */
    igUsername!: string
    /** The firstEvent. */
    firstEvent!: FirstEventBody | null
    /** The agents that use the connection. */
    agentIds!: ReadonlyArray<string>
}

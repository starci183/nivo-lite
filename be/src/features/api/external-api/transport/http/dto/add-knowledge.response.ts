/** What POST /api/v1/knowledge answers about the source. */
export class AddKnowledgeDataResponse {
    /** The source id. */
    id!: string
    /** The source is queued for indexing. */
    status!: "queued"
}

/** The HTTP response of POST /api/v1/knowledge: the public API wraps its payload in `data`. */
export class AddKnowledgeResponse {
    /** The queued source. */
    data!: AddKnowledgeDataResponse
}

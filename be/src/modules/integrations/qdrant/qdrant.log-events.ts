/** Log events of the Qdrant integration. */
export enum QdrantLogEvent {
    /** The collections and their payload indexes exist and agree with the app's vector size. */
    Prepared = "qdrant.collections.prepared",
    /** The service could not be reached while the collections were prepared: the app goes on and the meaning search answers by words. */
    Unreachable = "qdrant.collections.unreachable",
}

/** Log events of the text-to-speech integration. */
export enum TtsLogEvent {
    /** A clip could not be written into the cache directory and was written into the work directory instead. */
    CacheWriteFailed = "tts.cache.write-failed",
    /** The cache could not be trimmed; it only stays larger. */
    CachePruneFailed = "tts.cache.prune-failed",
}

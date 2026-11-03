const FNV_OFFSET = 0x81_1c_9d_c5
const FNV_PRIME = 0x01_00_01_93
const HEX = 16
const HASH_WIDTH = 8

/** A short stable hash of a text (FNV-1a over its UTF-16 units), so the same text in the same turn is one message. */
export const hashOf = (text: string): string => {
    let hash = FNV_OFFSET
    for (let index = 0; index < text.length; index += 1) {
        hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME)
    }
    return (hash >>> 0).toString(HEX).padStart(HASH_WIDTH, "0")
}

/** The key that makes a reply once per turn and text: a retry of the step sends nothing twice, a different text is a new message. */
export const replyKeyOf = (turnId: string, text: string): string => `reply:${turnId}:${hashOf(text)}`

/** The two numbers of a Redis stream id `<milliseconds>-<sequence>`; an id without a sequence has sequence zero. */
const partsOf = (id: string): readonly [number, number] => {
    const [milliseconds = "0", sequence = "0"] = id.split("-")
    return [Number(milliseconds), Number(sequence)]
}

/** Orders two stream ids: negative when `left` is older than `right`, zero when equal, positive when newer. */
export const compareStreamIds = (left: string, right: string): number => {
    const [leftMilliseconds, leftSequence] = partsOf(left)
    const [rightMilliseconds, rightSequence] = partsOf(right)
    return leftMilliseconds === rightMilliseconds ? leftSequence - rightSequence : leftMilliseconds - rightMilliseconds
}

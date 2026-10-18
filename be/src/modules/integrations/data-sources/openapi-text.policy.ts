/** Removes trailing URL separators with one backwards scan. */
export const trimUrlSlashes = (value: string): string => {
    let end = value.length
    while (end > 0 && value[end - 1] === "/") end--
    return value.slice(0, end)
}

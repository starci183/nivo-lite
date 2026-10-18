/**
 * Checks the shared permissive address shape without normalizing the input.
 * Requires one @, nonempty local text and a domain with a non-edge dot; whitespace is refused.
 * Repeated dots remain valid. Callers own trimming, casing and any stricter business validation.
 */
export const hasEmailAddressShape = (value: string): boolean => {
    const [local, domain, extra] = value.split("@")
    return (
        local !== undefined &&
        local !== "" &&
        domain !== undefined &&
        extra === undefined &&
        domain.slice(1, -1).includes(".") &&
        !/\s/u.test(value)
    )
}

/** True when a text has the shape of a Google access token: bounded, and only the characters such a token is made of. */
export const isPickerToken = (value: string): boolean =>
    value.length >= 20 && value.length <= 4096 && /^[\w.~+/=-]+$/u.test(value)

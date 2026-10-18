const EMAIL_PATTERN = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\](?=[^\s@<>(),;:"\\]*\.[^\s@<>(),;:"\\]{2})[^\s@<>(),;:"\\]+$/u
const ADDRESS_MAX = 254

/** Whether the text is a plausible email address. */
export const isMailAddress = (text: string): boolean => text.length <= ADDRESS_MAX && EMAIL_PATTERN.test(text)

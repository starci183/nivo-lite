export type Strength = "weak" | "ok" | "strong";

/** Rough strength hint for the sign-up / reset forms (length plus character variety). */
export const passwordStrength = (value: string): Strength => {
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (value.length < 8 || variety < 2) return "weak";
  if (value.length >= 12 && variety >= 3) return "strong";
  return value.length >= 10 && variety >= 3 ? "strong" : "ok";
};

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

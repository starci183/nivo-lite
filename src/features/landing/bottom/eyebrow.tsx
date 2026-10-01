import { CHIP, CHIP_DOT } from "./classNames";

export type EyebrowProps = { readonly children: string };

/** Template eyebrow chip: tiny crimson square + uppercase label. */
export const Eyebrow = ({ children }: EyebrowProps) => (
  <span className={CHIP}>
    <span className={CHIP_DOT} aria-hidden="true" />
    {children}
  </span>
);

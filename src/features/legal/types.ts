/** One block of a legal document. A section may end with the Google Limited Use statement (privacy only). */
export type LegalSection = {
  readonly id: string;
  readonly title: string;
  readonly paragraphs?: ReadonlyArray<string>;
  readonly items?: ReadonlyArray<string>;
  readonly afterItems?: ReadonlyArray<string>;
  /** Renders the verbatim Google API Services User Data Policy sentence, its link, then a Vietnamese explanation (vi only). */
  readonly limitedUse?: boolean;
};

export type LegalDoc = {
  readonly title: string;
  readonly draft: string;
  readonly intro: string;
  readonly sections: ReadonlyArray<LegalSection>;
};

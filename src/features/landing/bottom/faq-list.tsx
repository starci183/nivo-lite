"use client";

import { Accordion, SurfaceCard, Text } from "@starci/grammar/common";

export type FaqEntry = { readonly id: string; readonly question: string; readonly answer: string };
export type FaqListProps = { readonly label: string; readonly entries: ReadonlyArray<FaqEntry>; readonly defaultOpenId?: string };

/**
 * One column of the FAQ: a top-level card holding Grammar's unframed single-open `Accordion`. The question is the
 * Accordion's own trigger copy; no typography or colour class reaches into it (FONT, TONE: Grammar owns both).
 */
export const FaqList = ({ label, entries, defaultOpenId }: FaqListProps) => (
  <SurfaceCard ariaLabel={label}>
    <Accordion
      label={label}
      headingLevel={3}
      defaultExpandedIds={defaultOpenId ? [defaultOpenId] : []}
      items={entries.map((e) => ({
        id: e.id,
        title: e.question,
        content: (
          <Text as="p" size="sm">
            {e.answer}
          </Text>
        ),
      }))}
    />
  </SurfaceCard>
);

"use client";

import { Accordion, Text } from "@starci/grammar/common";

import { FAQ_COL } from "./classNames";

export type FaqEntry = { readonly id: string; readonly question: string; readonly answer: string };
export type FaqListProps = { readonly label: string; readonly entries: ReadonlyArray<FaqEntry>; readonly defaultOpenId?: string };

/** One column of the FAQ: a stack of single-open disclosures. */
export const FaqList = ({ label, entries, defaultOpenId }: FaqListProps) => (
  <Accordion
    label={label}
    className={FAQ_COL}
    headingLevel={3}
    defaultExpandedIds={defaultOpenId ? [defaultOpenId] : []}
    items={entries.map((e) => ({
      id: e.id,
      title: <span className="text-base font-medium text-[#0f172a]">{e.question}</span>,
      content: (
        <Text as="p" size="sm">
          {e.answer}
        </Text>
      ),
    }))}
  />
);


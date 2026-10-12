import { Text } from "@starci/grammar/common";
import { ChoiceTabs } from "../../leaves/ChoiceTabs";
import { ContributionGrid } from "../../leaves/ContributionGrid";
import { ContributionIntensityLegend } from "../../leaves/ContributionIntensityLegend";

import { ROOT_CLASS_NAME, ROW_CLASS_NAME } from "./classNames";

/** Public ContributionCalendarDay declaration. */
export type ContributionCalendarDay = {readonly date: string;readonly count: number;readonly label: string;};
/** Public ContributionCalendarData declaration. */
export type ContributionCalendarData = {readonly year: number;readonly years: ReadonlyArray<number>;readonly totalLabel?: string;readonly streakLabel?: string;readonly lessLabel?: string;readonly moreLabel?: string;readonly monthLabels?: ReadonlyArray<string>;readonly weekdayLabels?: ReadonlyArray<string>;readonly days?: ReadonlyArray<ContributionCalendarDay>;};
/** Public ContributionCalendarActions declaration. */
export type ContributionCalendarActions = {readonly selectYear?: (year: number) => void;};
/** Public ContributionCalendarProps declaration. */
export type ContributionCalendarProps = {readonly props: ContributionCalendarData;readonly on?: ContributionCalendarActions;readonly isLoading?: boolean;};

/** Public ContributionCalendar declaration. */
export const ContributionCalendar = (props: ContributionCalendarProps) => ContributionCalendarView(props);
const ContributionCalendarView = ({ props, on, isLoading = false }: ContributionCalendarProps) =>
<div className={ROOT_CLASS_NAME}>
        <div className={ROW_CLASS_NAME}>
            <Text size="xs" tone="muted" isSkeleton={isLoading}>{props.totalLabel}</Text>
            <ChoiceTabs props={{ label: props.totalLabel ?? "", selectedKey: String(props.year), tabs: props.years.map((year) => ({ id: String(year), label: String(year) })) }} on={{ select: (key) => on?.selectYear?.(Number(key)) }} />
        </div>
        <ContributionGrid props={{ year: props.year, monthLabels: props.monthLabels ?? [], weekdayLabels: props.weekdayLabels ?? [], days: props.days ?? [] }} isLoading={isLoading} />
        <div className={ROW_CLASS_NAME}>
            <Text size="sm" isSkeleton={isLoading}>{props.streakLabel}</Text>
            <ContributionIntensityLegend props={{ lessLabel: props.lessLabel, moreLabel: props.moreLabel }} isLoading={isLoading} />
        </div>
    </div>;

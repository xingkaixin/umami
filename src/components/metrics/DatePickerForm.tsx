import { Button, Calendar, Column, Row, ToggleGroup, ToggleGroupItem } from '@umami/react-zen';
import { endOfDay, isAfter, isBefore, isSameDay, min, startOfDay, subMonths } from 'date-fns';
import { useState } from 'react';
import { useMessages } from '@/components/hooks';

const FILTER_DAY = 'filter-day';
const FILTER_RANGE = 'filter-range';

export function DatePickerForm({
  startDate: defaultStartDate,
  endDate: defaultEndDate,
  minDate,
  maxDate,
  onChange,
  onClose,
}) {
  const [selected, setSelected] = useState<any>([
    isSameDay(defaultStartDate, defaultEndDate) ? FILTER_DAY : FILTER_RANGE,
  ]);
  const [date, setDate] = useState(defaultStartDate || new Date());
  const [startDate, setStartDate] = useState(defaultStartDate || new Date());
  const [endDate, setEndDate] = useState(defaultEndDate || new Date());
  const { t, labels } = useMessages();
  const rangeEndDate = endDate ?? startDate;

  const isInvalidDay = (value: Date) =>
    !value ||
    Boolean(minDate && isBefore(startOfDay(value), startOfDay(minDate))) ||
    Boolean(maxDate && isAfter(startOfDay(value), startOfDay(maxDate)));

  const disabled = selected.includes(FILTER_DAY)
    ? isInvalidDay(date)
    : isInvalidDay(startDate) || isInvalidDay(rangeEndDate) || isAfter(startDate, rangeEndDate);

  const handleSave = () => {
    if (selected.includes(FILTER_DAY)) {
      onChange(`range:${startOfDay(date).getTime()}:${endOfDay(date).getTime()}`);
    } else {
      onChange(`range:${startOfDay(startDate).getTime()}:${endOfDay(rangeEndDate).getTime()}`);
    }
  };

  return (
    <Column gap>
      <Row justifyContent="center">
        <ToggleGroup
          value={selected}
          onChange={value => {
            if (value.length) {
              setSelected(value);
            }
          }}
        >
          <ToggleGroupItem id={FILTER_DAY}>{t(labels.singleDay)}</ToggleGroupItem>
          <ToggleGroupItem id={FILTER_RANGE}>{t(labels.dateRange)}</ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Column>
        {selected.includes(FILTER_DAY) && (
          <Calendar
            value={date}
            minValue={minDate}
            maxValue={maxDate}
            onChange={setDate}
            required
          />
        )}
        {selected.includes(FILTER_RANGE) && (
          <Calendar
            mode="range"
            numberOfMonths={2}
            // react-zen's CalendarProps type drops range-only props
            {...{ resetOnSelect: true }}
            selected={{ from: startDate, to: endDate }}
            defaultValue={subMonths(min([rangeEndDate, new Date()]), 1)}
            showOutsideDays={false}
            minValue={minDate}
            maxValue={maxDate}
            onSelect={selection => {
              const range = selection as { from?: Date; to?: Date } | undefined;
              setStartDate(range?.from);
              setEndDate(range?.to);
            }}
            required
            style={{ margin: '0 auto' }}
          />
        )}
      </Column>
      <Row justifyContent="end" gap>
        <Button onPress={onClose}>{t(labels.cancel)}</Button>
        <Button variant="primary" onPress={handleSave} isDisabled={disabled}>
          {t(labels.apply)}
        </Button>
      </Row>
    </Column>
  );
}

import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getTestRouter, setTestUrl } from '@/test/navigation';
import { render, screen } from '@/test/render';
import { DataGrid, type DataGridProps } from './DataGrid';

const query = {
  data: { data: [], count: 0, page: 1, pageSize: 20 },
  isLoading: false,
  isFetching: false,
} as DataGridProps['query'];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function renderGrid(route: string) {
  const grid = (
    <DataGrid query={query} allowSearch>
      {null}
    </DataGrid>
  );
  const result = render(grid, { route });

  return (url: string) =>
    act(() => {
      setTestUrl(url);
      result.rerender(
        <DataGrid query={query} allowSearch>
          {null}
        </DataGrid>,
      );
    });
}

function typeSearch(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  // SearchField reports changes on a zero-delay timer.
  act(() => vi.advanceTimersByTime(0));
}

test('keeps newer search text when an earlier navigation finishes', () => {
  const landUrl = renderGrid('/websites');
  const search = screen.getByRole('searchbox');

  typeSearch(search, 'shop');
  act(() => vi.advanceTimersByTime(600));
  expect(getTestRouter().push).toHaveBeenLastCalledWith('/websites?search=shop&page=1');

  typeSearch(search, 'shop studio');
  landUrl('/websites?search=shop&page=1');

  expect(search).toHaveValue('shop studio');
  act(() => vi.advanceTimersByTime(600));
  expect(getTestRouter().push).toHaveBeenLastCalledWith('/websites?search=shop+studio&page=1');
});

test('syncs searches from external navigation, including abandoned search destinations', () => {
  const landUrl = renderGrid('/websites?search=original');
  const search = screen.getByRole('searchbox');

  typeSearch(search, 'shop');
  act(() => vi.advanceTimersByTime(600));
  landUrl('/websites?search=studio');
  expect(search).toHaveValue('studio');

  landUrl('/websites?search=shop');
  expect(search).toHaveValue('shop');
});

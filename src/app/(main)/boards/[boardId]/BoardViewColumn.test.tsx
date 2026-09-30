import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { BoardViewColumn } from './BoardViewColumn';

vi.mock('@/components/hooks', () => ({
  useBoard: () => ({ board: { type: 'board', parameters: {} } }),
  useMessages: () => ({ t: (value: string) => value, labels: {}, messages: {} }),
  useWebsiteQuery: () => ({ isLoading: false, error: { status: 404 } }),
  usePixelQuery: () => ({ isLoading: false }),
  useLinkQuery: () => ({ isLoading: false }),
}));

vi.mock('../boardComponentRegistry', () => ({
  getComponentDefinition: () => ({ requiresWebsite: true }),
}));

vi.mock('./BoardComponentRenderer', () => ({
  BoardComponentRenderer: () => <div>Website analytics</div>,
}));

test('shows an unavailable item instead of analytics for a deleted website', () => {
  render(
    <BoardViewColumn
      component={{ type: 'metrics', entityType: 'website', entityId: 'deleted-website' }}
    />,
  );

  expect(screen.getByText('Selected item is no longer available.')).toBeInTheDocument();
  expect(screen.queryByText('Website analytics')).not.toBeInTheDocument();
});

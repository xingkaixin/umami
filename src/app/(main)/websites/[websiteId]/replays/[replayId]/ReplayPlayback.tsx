'use client';
import { Button, Column, Dialog, DialogTrigger, Icon, Popover, Row, Text } from '@umami/react-zen';
import { Bookmark, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SessionInfo } from '@/app/(main)/websites/[websiteId]/sessions/SessionInfo';
import { Avatar } from '@/components/common/Avatar';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import {
  useMessages,
  useMobile,
  useNavigation,
  useReplayQuery,
  useReplaySavedQuery,
  useUpdateQuery,
  useWebsiteSessionQuery,
} from '@/components/hooks';
import { touch } from '@/components/hooks/useModified';
import { getReplayViewport } from '@/lib/replay';
import { type ReplaySource, useReplays } from '@/store/replays';
import { ReplayPlayer } from './ReplayPlayer';
import { ReplaySaveForm } from './ReplaySaveForm';

type ReplayOrientation = 'portrait' | 'landscape';

const getReplayId = (replay: any): string => replay.visitId || replay.id;

export function ReplayPlayback({
  websiteId,
  replayId,
  showSessionInfo = true,
  replaySource,
  onClose,
  onReplayStateChange,
}: {
  websiteId: string;
  replayId: string;
  showSessionInfo?: boolean;
  replaySource?: ReplaySource;
  onClose?: () => void;
  onReplayStateChange?: (orientation: ReplayOrientation | null) => void;
}) {
  const { data: replay, isLoading, error } = useReplayQuery(websiteId, replayId);
  const { data: replaySaved } = useReplaySavedQuery(websiteId, replayId);
  const { data: session } = useWebsiteSessionQuery(websiteId, replay?.sessionId);
  const { t, labels } = useMessages();
  const { isMobile } = useMobile();
  const { router, updateParams } = useNavigation();
  const [savedState, setSavedState] = useState<{ replayId: string; isSaved: boolean } | null>(null);
  const { mutate } = useUpdateQuery(`/websites/${websiteId}/replays/saved/${replayId}`);
  const replayList = useReplays();
  const navigationReplays =
    replaySource && replayList.websiteId === websiteId && replayList.source === replaySource
      ? replayList.replays
      : [];
  const currentIndex = navigationReplays.findIndex(r => getReplayId(r) === replayId);
  const prevReplay = currentIndex > 0 ? navigationReplays[currentIndex - 1] : null;
  const nextReplay =
    currentIndex !== -1 && currentIndex < navigationReplays.length - 1
      ? navigationReplays[currentIndex + 1]
      : null;
  const replayViewport = useMemo(() => getReplayViewport(replay?.events), [replay?.events]);
  const replayOrientation: ReplayOrientation | null = replayViewport
    ? replayViewport.height > replayViewport.width
      ? 'portrait'
      : 'landscape'
    : replay
      ? 'landscape'
      : null;

  const saved =
    savedState?.replayId === replayId ? savedState.isSaved : (replaySaved?.isSaved ?? false);

  useEffect(() => {
    onReplayStateChange?.(replayOrientation);
  }, [replayOrientation, onReplayStateChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.isComposing ||
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="slider"]',
        )
      ) {
        return;
      }

      const replay =
        e.key === 'ArrowLeft' ? prevReplay : e.key === 'ArrowRight' ? nextReplay : null;

      if (replay) {
        e.preventDefault();
        router.push(updateParams({ replay: getReplayId(replay) }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevReplay, nextReplay, router, updateParams]);

  const handleUnsave = () => {
    setSavedState({ replayId, isSaved: false });
    mutate({ isSaved: false }, { onSuccess: () => touch('replays') });
  };

  return (
    <LoadingPanel
      data={replay}
      isLoading={isLoading}
      error={error}
      loadingIcon="spinner"
      style={{ minHeight: '400px' }}
    >
      {replay && (
        <Column gap="6" width="100%" minWidth="0">
          {session && (
            <Row
              justifyContent="space-between"
              alignItems="flex-start"
              gap="3"
              style={{ flexWrap: isMobile ? 'wrap' : 'nowrap' }}
            >
              <Row alignItems="center" gap="4" minWidth="0" style={{ flex: '1 1 240px' }}>
                <Avatar seed={replay.sessionId} size={48} />
                <Column minWidth="0">
                  <Text weight="bold">{t(labels.replay)}</Text>
                  <Text color="muted">
                    {replay.eventCount} {t(labels.actions).toLowerCase()}
                  </Text>
                </Column>
              </Row>
              <Row gap="2" style={{ flex: '0 0 auto' }}>
                {replaySource && (
                  <>
                    <Button
                      aria-label={t(labels.previous)}
                      variant="quiet"
                      isDisabled={!prevReplay}
                      onPress={() => router.push(updateParams({ replay: getReplayId(prevReplay) }))}
                    >
                      <Icon>
                        <ChevronLeft />
                      </Icon>
                    </Button>
                    <Button
                      aria-label={t(labels.next)}
                      variant="quiet"
                      isDisabled={!nextReplay}
                      onPress={() => router.push(updateParams({ replay: getReplayId(nextReplay) }))}
                    >
                      <Icon>
                        <ChevronRight />
                      </Icon>
                    </Button>
                  </>
                )}
                {saved ? (
                  <Button onPress={handleUnsave} variant="quiet">
                    <Icon>
                      <Bookmark fill="currentColor" />
                    </Icon>
                  </Button>
                ) : (
                  <DialogTrigger>
                    <Button variant="quiet">
                      <Icon>
                        <Bookmark fill="none" />
                      </Icon>
                    </Button>
                    <Popover side="bottom" align="end">
                      <Dialog title={t(labels.saveReplay)} style={{ width: '300px' }}>
                        {({ close }) => (
                          <ReplaySaveForm
                            websiteId={websiteId}
                            replayId={replayId}
                            onSave={() => {
                              setSavedState({ replayId, isSaved: true });
                              touch('replays');
                            }}
                            onClose={close}
                          />
                        )}
                      </Dialog>
                    </Popover>
                  </DialogTrigger>
                )}
                {onClose && (
                  <Button onPress={onClose} variant="quiet">
                    <Icon>
                      <X />
                    </Icon>
                  </Button>
                )}
              </Row>
            </Row>
          )}
          <ReplayPlayer events={replay.events} />
          {showSessionInfo && session && <SessionInfo data={session} />}
        </Column>
      )}
    </LoadingPanel>
  );
}

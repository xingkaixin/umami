'use client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Column,
  Dialog,
  Form,
  FormButtons,
  FormField,
  FormSubmitButton,
  Icon,
  ListItem,
  Modal,
  Row,
  Select,
  Text,
  TextField,
} from '@umami/react-zen';
import { useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { ConfirmationForm } from '@/components/common/ConfirmationForm';
import { ControlledDialog } from '@/components/common/ControlledDialog';
import { CopyButton } from '@/components/common/CopyButton';
import { Panel } from '@/components/common/Panel';
import { useApi, useDeleteQuery, useMessages, useMobile, useUpdateQuery } from '@/components/hooks';
import { KeyRound, Plus, Trash } from '@/components/icons';

interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CreatedApiToken extends ApiTokenItem {
  token: string;
}

const QUERY_KEY = ['me-api-tokens'];
const rowBorder = '1px solid var(--zen-border)';
const desktopGrid =
  'minmax(160px, 1.4fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(110px, 1fr) auto';

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString();
}

export function ApiTokensSection() {
  const { t, labels, messages } = useMessages();
  const { get, useQuery } = useApi();
  const { isMobile } = useMobile();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ data: ApiTokenItem[] }>({
    queryKey: QUERY_KEY,
    queryFn: () => get('/me/tokens'),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenItem | null>(null);

  const tokens = data?.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  return (
    <Panel>
      <Column gap="4">
        <Row alignItems="center" justifyContent="space-between" gap="3" wrap="wrap">
          <Row alignItems="center" gap="3">
            <Icon>
              <KeyRound />
            </Icon>
            <Text weight="bold">{t(labels.apiTokens)}</Text>
            <Badge variant="gray" dot={false}>
              {t(labels.readOnly)}
            </Badge>
          </Row>
          <Button variant="primary" onPress={() => setShowCreate(true)}>
            <Icon>
              <Plus />
            </Icon>
            <Text>{t(labels.createToken)}</Text>
          </Button>
        </Row>

        <Text color="muted">{t(messages.apiTokensDescription)}</Text>

        {!isLoading && tokens.length === 0 ? (
          <Text size="sm" color="muted">
            {t(messages.apiTokensEmpty)}
          </Text>
        ) : null}

        {tokens.length > 0 ? (
          <div style={{ width: '100%' }}>
            {!isMobile && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: desktopGrid,
                  gap: '16px',
                  alignItems: 'center',
                  padding: '0 0 12px',
                  borderBottom: rowBorder,
                }}
              >
                <Text weight="bold">{t(labels.name)}</Text>
                <Text weight="bold">{t(labels.tokenPrefix)}</Text>
                <Text weight="bold">{t(labels.lastUsed)}</Text>
                <Text weight="bold">{t(labels.expires)}</Text>
                <div />
              </div>
            )}
            {tokens.map(item => {
              const isExpired = Boolean(item.expiresAt && new Date(item.expiresAt) <= new Date());
              const expiresText = item.expiresAt
                ? formatDate(item.expiresAt, t(labels.never))
                : t(labels.never);

              if (isMobile) {
                return (
                  <Column
                    key={item.id}
                    gap="2"
                    style={{ padding: '12px 0', borderBottom: rowBorder }}
                  >
                    <Row alignItems="center" justifyContent="space-between" gap="2">
                      <Text weight="bold">{item.name}</Text>
                      <Button
                        variant="quiet"
                        aria-label={t(labels.revokeToken)}
                        onPress={() => setRevokeTarget(item)}
                      >
                        <Icon>
                          <Trash />
                        </Icon>
                      </Button>
                    </Row>
                    <Text size="sm" color="muted">
                      <code>{item.tokenPrefix}...</code>
                    </Text>
                    <Row gap="4" wrap="wrap">
                      <Text size="sm" color="muted">
                        {t(labels.lastUsed)}: {formatDate(item.lastUsedAt, t(labels.never))}
                      </Text>
                      <Text size="sm" color="muted">
                        {t(labels.expires)}: {isExpired ? t(labels.expired) : expiresText}
                      </Text>
                    </Row>
                  </Column>
                );
              }

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: desktopGrid,
                    gap: '16px',
                    alignItems: 'center',
                    minHeight: '52px',
                    padding: '10px 0',
                    borderBottom: rowBorder,
                  }}
                >
                  <Text>{item.name}</Text>
                  <Text color="muted">
                    <code>{item.tokenPrefix}...</code>
                  </Text>
                  <Text color="muted">{formatDate(item.lastUsedAt, t(labels.never))}</Text>
                  <Row alignItems="center" gap="2">
                    {isExpired ? (
                      <Badge variant="danger">{t(labels.expired)}</Badge>
                    ) : (
                      <Text color="muted">{expiresText}</Text>
                    )}
                  </Row>
                  <Row justifyContent="flex-end">
                    <Button
                      variant="quiet"
                      aria-label={t(labels.revokeToken)}
                      onPress={() => setRevokeTarget(item)}
                    >
                      <Icon>
                        <Trash />
                      </Icon>
                    </Button>
                  </Row>
                </div>
              );
            })}
          </div>
        ) : null}
      </Column>

      {showCreate && (
        <CreateApiTokenModal
          onClose={() => setShowCreate(false)}
          onCreated={token => {
            setShowCreate(false);
            setCreatedToken(token);
            refresh();
          }}
        />
      )}

      {createdToken && (
        <CreatedApiTokenModal token={createdToken} onClose={() => setCreatedToken(null)} />
      )}

      {revokeTarget && (
        <RevokeApiTokenModal
          token={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={() => {
            setRevokeTarget(null);
            refresh();
          }}
        />
      )}
    </Panel>
  );
}

function CreateApiTokenModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (token: CreatedApiToken) => void;
}) {
  const { t, labels, getErrorMessage } = useMessages();
  const { mutateAsync, error, isPending } = useUpdateQuery('/me/tokens');

  const handleSubmit = async (values: { name: string; expiresInDays?: string }) => {
    const days =
      values.expiresInDays && values.expiresInDays !== 'never'
        ? Number(values.expiresInDays)
        : null;
    await mutateAsync(
      { name: values.name.trim(), expiresInDays: days },
      {
        onSuccess: (created: CreatedApiToken) => onCreated(created),
      },
    );
  };

  return (
    <ControlledDialog>
      <Modal isOpen={true} onOpenChange={isOpen => !isOpen && onClose()}>
        <Dialog title={t(labels.createToken)} style={{ width: '440px', padding: '28px' }}>
          <Form
            onSubmit={handleSubmit}
            values={{ name: '', expiresInDays: 'never' }}
            error={getErrorMessage(error)}
          >
            <FormField name="name" label={t(labels.name)} rules={{ required: t(labels.required) }}>
              <TextField autoComplete="off" autoFocus placeholder="agent-cli" />
            </FormField>
            <FormField name="expiresInDays" label={t(labels.expiration)}>
              <Select>
                <ListItem id="never">{t(labels.never)}</ListItem>
                <ListItem id="30">{t(labels.days30)}</ListItem>
                <ListItem id="90">{t(labels.days90)}</ListItem>
                <ListItem id="365">{t(labels.days365)}</ListItem>
              </Select>
            </FormField>
            <FormButtons>
              <Button isDisabled={isPending} onPress={onClose}>
                {t(labels.cancel)}
              </Button>
              <FormSubmitButton variant="primary" isDisabled={isPending}>
                {t(labels.createToken)}
              </FormSubmitButton>
            </FormButtons>
          </Form>
        </Dialog>
      </Modal>
    </ControlledDialog>
  );
}

function CreatedApiTokenModal({ token, onClose }: { token: CreatedApiToken; onClose: () => void }) {
  const { t, labels, messages } = useMessages();

  return (
    <ControlledDialog>
      <Modal isOpen={true} onOpenChange={isOpen => !isOpen && onClose()}>
        <Dialog title={token.name} style={{ width: '520px', padding: '28px' }}>
          <Column gap="4">
            <Text>{t(messages.apiTokenCreatedOnce)}</Text>
            <Row alignItems="center" gap="2">
              <TextField value={token.token} isReadOnly style={{ flex: 1 }} />
              <CopyButton value={token.token} />
            </Row>
            <Row justifyContent="flex-end">
              <Button variant="primary" onPress={onClose}>
                {t(labels.close)}
              </Button>
            </Row>
          </Column>
        </Dialog>
      </Modal>
    </ControlledDialog>
  );
}

function RevokeApiTokenModal({
  token,
  onClose,
  onRevoked,
}: {
  token: ApiTokenItem;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const { t, labels, messages, getErrorMessage } = useMessages();
  const { mutateAsync, isPending, error } = useDeleteQuery(`/me/tokens/${token.id}`);

  const handleConfirm = async () => {
    await mutateAsync(null, { onSuccess: onRevoked });
  };

  return (
    <ControlledDialog>
      <Modal isOpen={true} onOpenChange={isOpen => !isOpen && onClose()}>
        <Dialog title={t(labels.confirm)} style={{ width: '400px', padding: '28px' }}>
          <ConfirmationForm
            message={t.rich(messages.confirmRemove, {
              target: token.name,
              b: chunks => <b>{chunks}</b>,
            })}
            isLoading={isPending}
            error={getErrorMessage(error)}
            onConfirm={handleConfirm}
            onClose={onClose}
            buttonLabel={t(labels.revokeToken)}
            buttonVariant="danger"
          />
        </Dialog>
      </Modal>
    </ControlledDialog>
  );
}

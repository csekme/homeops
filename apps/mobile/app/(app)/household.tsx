import { useGetMe, useListHouseholds } from '@homeops/api-client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { TextField } from '@/components/text-field';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  Icon,
  TrashIcon,
} from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActiveHousehold } from '@/features/households/use-households';
import { initials } from '@/lib/initials';
import {
  useArchiveHouseholdAction,
  useRenameForm,
} from '@/features/households/use-household-admin';
import {
  useInvitationActions,
  useInvitations,
  useInviteForm,
} from '@/features/households/use-invitations';
import { useMemberActions, useMembers } from '@/features/households/use-members';

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CHILD'] as const;
type Role = (typeof ROLES)[number];

/** Map a role onto a badge variant so the role reads at a glance. */
function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'OWNER') return 'default';
  if (role === 'ADMIN') return 'secondary';
  return 'outline';
}

/** Bottom-sheet role picker. Reused by the member list and the invite form. */
function RoleSelectSheet({
  isOpen,
  current,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  current: string;
  onClose: () => void;
  onSelect: (role: Role) => void;
}) {
  const { t } = useTranslation('households');
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <Heading size="sm" className="w-full px-3 pb-1 pt-2">
          {t('members.changeRole')}
        </Heading>
        {ROLES.map((r) => (
          <ActionsheetItem
            key={r}
            onPress={() => {
              onSelect(r);
              onClose();
            }}
          >
            <ActionsheetItemText className={r === current ? 'font-semibold text-foreground' : ''}>
              {t(`roles.${r}`)}
            </ActionsheetItemText>
            {r === current ? <Icon as={CheckIcon} size="sm" className="ml-auto text-primary" /> : null}
          </ActionsheetItem>
        ))}
      </ActionsheetContent>
    </Actionsheet>
  );
}

/** Bottom-sheet destructive confirmation, so a stray tap can't remove anyone. */
function ConfirmSheet({
  isOpen,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('households');
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack space="xs" className="w-full px-3 pb-3 pt-2">
          <Heading size="sm">{title}</Heading>
          {description ? (
            <Text className="text-sm text-muted-foreground">{description}</Text>
          ) : null}
        </VStack>
        <VStack space="sm" className="w-full px-3 pb-2">
          <Button
            variant="destructive"
            onPress={() => {
              onConfirm();
              onClose();
            }}
          >
            <ButtonText>{confirmLabel}</ButtonText>
          </Button>
          <Button variant="outline" onPress={onClose}>
            <ButtonText>{t('general.cancel')}</ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

/** A grouped settings section: a small muted header above a card. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack space="sm">
      <Text className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
    </VStack>
  );
}

export default function HouseholdManageScreen() {
  const { t } = useTranslation('households');
  const router = useRouter();
  const { activeHouseholdId, isOwner, canManageMembers } = useActiveHousehold();
  const { data: households } = useListHouseholds();
  const { data: me } = useGetMe();

  if (!activeHouseholdId) {
    // No active household — bounce back to the dashboard.
    router.replace('/');
    return null;
  }

  const active = (households?.households ?? []).find((h) => h.id === activeHouseholdId);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <HStack className="items-center gap-1 px-2 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('general.back')}
            className="h-10 w-10 items-center justify-center rounded-md"
          >
            <Icon as={ChevronLeftIcon} size="xl" className="text-foreground" />
          </Pressable>
          <Heading size="lg" numberOfLines={1} className="flex-1">
            {active?.name ?? t('settings.title')}
          </Heading>
        </HStack>

        <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
          <GeneralSection
            householdId={activeHouseholdId}
            name={active?.name ?? ''}
            currency={active?.default_currency ?? 'HUF'}
            canManage={canManageMembers}
          />

          <MembersSection
            householdId={activeHouseholdId}
            canManage={canManageMembers}
            currentUserId={me?.id}
          />

          {canManageMembers ? <InvitationsSection householdId={activeHouseholdId} /> : null}

          {/* Danger zone pinned to the bottom of the screen, below every other section. */}
          {isOwner ? (
            <DangerZoneSection
              householdId={activeHouseholdId}
              onArchived={() => router.replace('/')}
            />
          ) : null}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

function GeneralSection({
  householdId,
  name,
  currency,
  canManage,
}: {
  householdId: string;
  name: string;
  currency: string;
  canManage: boolean;
}) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending, isError, errorKey } = useRenameForm(householdId, name, currency);
  const { errors } = form.formState;

  return (
    <Section title={t('settings.tabs.general')}>
      <Card>
        <VStack space="md">
          {isError ? (
            <Alert variant="destructive">
              <AlertIcon as={AlertCircleIcon} />
              <AlertText>{t(errorKey)}</AlertText>
            </Alert>
          ) : null}
          <TextField
            control={form.control}
            name="name"
            label={t('general.nameLabel')}
            editable={canManage}
            errorMessage={errors.name?.message}
          />
          {canManage ? (
            <Button onPress={onSubmit} isDisabled={isPending} className="self-start">
              {isPending ? <ButtonSpinner /> : null}
              <ButtonText>{t('general.rename')}</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </Card>
    </Section>
  );
}

/** Archive (destructive) — rendered last so it sits at the very bottom of the screen. */
function DangerZoneSection({
  householdId,
  onArchived,
}: {
  householdId: string;
  onArchived: () => void;
}) {
  const { t } = useTranslation('households');
  const { onArchive, isPending: archiving } = useArchiveHouseholdAction(householdId, onArchived);
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <Section title={t('general.dangerZone')}>
      <Card className="border-destructive/40">
        <VStack space="sm">
          <Text className="text-sm text-muted-foreground">{t('general.archiveDescription')}</Text>
          <Button
            variant="outline"
            onPress={() => setConfirmArchive(true)}
            isDisabled={archiving}
            className="self-start border-destructive"
          >
            {archiving ? <ButtonSpinner /> : null}
            <ButtonText>{t('general.archive')}</ButtonText>
          </Button>
        </VStack>
      </Card>

      <ConfirmSheet
        isOpen={confirmArchive}
        title={t('general.archiveConfirmTitle')}
        description={t('general.archiveDescription')}
        confirmLabel={t('general.archive')}
        onClose={() => setConfirmArchive(false)}
        onConfirm={onArchive}
      />
    </Section>
  );
}

function MembersSection({
  householdId,
  canManage,
  currentUserId,
}: {
  householdId: string;
  canManage: boolean;
  currentUserId: string | undefined;
}) {
  const { t } = useTranslation('households');
  const { members } = useMembers(householdId);
  const { onChangeRole, onRemove } = useMemberActions(householdId, currentUserId);

  const [roleSheet, setRoleSheet] = useState<{ userId: string; current: string } | null>(null);
  const [confirm, setConfirm] = useState<{ userId: string; isSelf: boolean } | null>(null);

  return (
    <Section title={t('members.title')}>
      <Card className="gap-0 p-0">
        {members.map((m, i) => {
          const isSelf = m.user_id === currentUserId;
          const role = m.role ?? 'MEMBER';
          const canEdit = canManage && !isSelf;
          return (
            <View key={m.membership_id}>
              {i > 0 ? <Divider /> : null}
              <HStack space="md" className="items-center p-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallbackText>{initials(m.display_name)}</AvatarFallbackText>
                </Avatar>
                <VStack space="xs" className="flex-1">
                  <HStack space="xs" className="items-center">
                    <Text className="font-medium" numberOfLines={1}>
                      {m.display_name}
                    </Text>
                    {isSelf ? (
                      <Text className="text-xs text-muted-foreground">({t('members.you')})</Text>
                    ) : null}
                  </HStack>
                  <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                    {m.email}
                  </Text>
                  {canEdit ? (
                    <Pressable
                      onPress={() => setRoleSheet({ userId: m.user_id!, current: role })}
                      className="mt-1 flex-row items-center gap-1 self-start"
                    >
                      <Badge variant={roleBadgeVariant(role)}>
                        <BadgeText>{t(`roles.${role}`)}</BadgeText>
                      </Badge>
                      <Icon as={ChevronDownIcon} size="xs" className="text-muted-foreground" />
                    </Pressable>
                  ) : (
                    <Badge variant={roleBadgeVariant(role)} className="mt-1 self-start">
                      <BadgeText>{t(`roles.${role}`)}</BadgeText>
                    </Badge>
                  )}
                </VStack>
                {isSelf || canManage ? (
                  <Pressable
                    onPress={() => setConfirm({ userId: m.user_id!, isSelf })}
                    accessibilityRole="button"
                    accessibilityLabel={isSelf ? t('members.leave') : t('members.remove')}
                    className="h-10 w-10 items-center justify-center rounded-md"
                  >
                    <Icon as={TrashIcon} size="sm" className="text-destructive" />
                  </Pressable>
                ) : null}
              </HStack>
            </View>
          );
        })}
      </Card>

      <RoleSelectSheet
        isOpen={roleSheet !== null}
        current={roleSheet?.current ?? ''}
        onClose={() => setRoleSheet(null)}
        onSelect={(role) => {
          if (roleSheet) onChangeRole(roleSheet.userId, role);
        }}
      />

      <ConfirmSheet
        isOpen={confirm !== null}
        title={confirm?.isSelf ? t('members.leaveConfirmTitle') : t('members.removeConfirmTitle')}
        description={
          confirm?.isSelf
            ? t('members.leaveConfirmDescription')
            : t('members.removeConfirmDescription')
        }
        confirmLabel={confirm?.isSelf ? t('members.leave') : t('members.remove')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) onRemove(confirm.userId);
        }}
      />
    </Section>
  );
}

function InvitationsSection({ householdId }: { householdId: string }) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending, isError, errorKey } = useInviteForm(householdId);
  const { invitations } = useInvitations(householdId);
  const { onResend, onRevoke } = useInvitationActions(householdId);
  const { errors } = form.formState;
  const [role, setRole] = useState<Role>('MEMBER');
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const submit = () => {
    form.setValue('role', role as never);
    onSubmit();
  };

  return (
    <Section title={t('invitations.title')}>
      <Card>
        <VStack space="md">
          {isError ? (
            <Alert variant="destructive">
              <AlertIcon as={AlertCircleIcon} />
              <AlertText>{t(errorKey)}</AlertText>
            </Alert>
          ) : null}
          <TextField
            control={form.control}
            name="email"
            label={t('invitations.emailLabel')}
            placeholder={t('invitations.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            errorMessage={errors.email?.message}
          />
          <VStack space="xs">
            <Text className="text-sm font-medium">{t('invitations.roleLabel')}</Text>
            <Pressable
              onPress={() => setRoleSheetOpen(true)}
              className="flex-row items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <Text>{t(`roles.${role}`)}</Text>
              <Icon as={ChevronDownIcon} size="sm" className="text-muted-foreground" />
            </Pressable>
          </VStack>
          <Button onPress={submit} isDisabled={isPending} className="self-start">
            {isPending ? <ButtonSpinner /> : null}
            <ButtonText>{t('invitations.send')}</ButtonText>
          </Button>
        </VStack>
      </Card>

      <Text className="px-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('invitations.pending')}
      </Text>
      {invitations.length === 0 ? (
        <Card>
          <Text className="text-sm text-muted-foreground">{t('invitations.none')}</Text>
        </Card>
      ) : (
        <Card className="gap-0 p-0">
          {invitations.map((inv, i) => (
            <View key={inv.id}>
              {i > 0 ? <Divider /> : null}
              <HStack className="items-center justify-between p-4" space="md">
                <VStack space="xs" className="flex-1">
                  <Text className="font-medium" numberOfLines={1}>
                    {inv.email}
                  </Text>
                  <Badge variant={roleBadgeVariant(inv.role ?? 'MEMBER')} className="self-start">
                    <BadgeText>{t(`roles.${inv.role}`)}</BadgeText>
                  </Badge>
                </VStack>
                <HStack space="xs" className="items-center">
                  <Button variant="ghost" size="sm" onPress={() => onResend(inv.id!)}>
                    <ButtonText className="text-primary">{t('invitations.resend')}</ButtonText>
                  </Button>
                  <Pressable
                    onPress={() => setRevokeId(inv.id!)}
                    accessibilityRole="button"
                    accessibilityLabel={t('invitations.revoke')}
                    className="h-10 w-10 items-center justify-center rounded-md"
                  >
                    <Icon as={TrashIcon} size="sm" className="text-destructive" />
                  </Pressable>
                </HStack>
              </HStack>
            </View>
          ))}
        </Card>
      )}

      <RoleSelectSheet
        isOpen={roleSheetOpen}
        current={role}
        onClose={() => setRoleSheetOpen(false)}
        onSelect={setRole}
      />

      <ConfirmSheet
        isOpen={revokeId !== null}
        title={t('invitations.revokeConfirmTitle')}
        description={t('invitations.revokeConfirmDescription')}
        confirmLabel={t('invitations.revoke')}
        onClose={() => setRevokeId(null)}
        onConfirm={() => {
          if (revokeId) onRevoke(revokeId);
        }}
      />
    </Section>
  );
}

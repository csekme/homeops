import { useGetMe, useListHouseholds } from '@homeops/api-client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/text-field';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { AlertCircleIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActiveHousehold } from '@/features/households/use-households';
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

function RoleChips({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange?: (role: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('households');
  return (
    <HStack space="xs" className="flex-wrap">
      {ROLES.map((r) => {
        const selected = r === value;
        return (
          <Pressable
            key={r}
            disabled={disabled || !onChange || selected}
            onPress={() => onChange?.(r)}
            className={`rounded-full border px-3 py-1 ${
              selected ? 'border-primary bg-primary' : 'border-border'
            }`}
          >
            <Text className={`text-xs ${selected ? 'text-primary-foreground' : ''}`}>
              {t(`roles.${r}`)}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
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
        <HStack className="items-center justify-between px-4 py-3">
          <Heading size="lg">{active?.name ?? t('settings.title')}</Heading>
          <Pressable onPress={() => router.back()}>
            <Text className="text-primary">{t('general.cancel')}</Text>
          </Pressable>
        </HStack>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
          <GeneralSection
            householdId={activeHouseholdId}
            name={active?.name ?? ''}
            currency={active?.default_currency ?? 'HUF'}
            canManage={canManageMembers}
            isOwner={isOwner}
            onArchived={() => router.replace('/')}
          />

          <MembersSection
            householdId={activeHouseholdId}
            canManage={canManageMembers}
            currentUserId={me?.id}
          />

          {canManageMembers ? <InvitationsSection householdId={activeHouseholdId} /> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function GeneralSection({
  householdId,
  name,
  currency,
  canManage,
  isOwner,
  onArchived,
}: {
  householdId: string;
  name: string;
  currency: string;
  canManage: boolean;
  isOwner: boolean;
  onArchived: () => void;
}) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending, isError, errorKey } = useRenameForm(householdId, name, currency);
  const { onArchive, isPending: archiving } = useArchiveHouseholdAction(householdId, onArchived);
  const { errors } = form.formState;

  return (
    <VStack space="md">
      <Heading size="md">{t('settings.tabs.general')}</Heading>
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

      {isOwner ? (
        <VStack space="sm" className="mt-2 rounded-xl border border-destructive/40 p-4">
          <Heading size="sm" className="text-destructive">
            {t('general.dangerZone')}
          </Heading>
          <Text className="text-sm text-muted-foreground">{t('general.archiveDescription')}</Text>
          <Button
            variant="outline"
            onPress={onArchive}
            isDisabled={archiving}
            className="self-start border-destructive"
          >
            {archiving ? <ButtonSpinner /> : null}
            <ButtonText>{t('general.archive')}</ButtonText>
          </Button>
        </VStack>
      ) : null}
    </VStack>
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

  return (
    <VStack space="md">
      <Heading size="md">{t('members.title')}</Heading>
      <VStack className="rounded-xl border border-border">
        {members.map((m, i) => {
          const isSelf = m.user_id === currentUserId;
          return (
            <View key={m.membership_id}>
              {i > 0 ? <Divider /> : null}
              <VStack space="sm" className="p-4">
                <HStack className="items-center justify-between">
                  <VStack className="flex-1">
                    <HStack space="xs" className="items-center">
                      <Text className="font-medium">{m.display_name}</Text>
                      {isSelf ? (
                        <Text className="text-xs text-muted-foreground">
                          ({t('members.you')})
                        </Text>
                      ) : null}
                    </HStack>
                    <Text className="text-sm text-muted-foreground">{m.email}</Text>
                  </VStack>
                  {isSelf ? (
                    <Pressable onPress={() => onRemove(m.user_id!)}>
                      <Text className="text-sm text-destructive">{t('members.leave')}</Text>
                    </Pressable>
                  ) : canManage ? (
                    <Pressable onPress={() => onRemove(m.user_id!)}>
                      <Text className="text-sm text-destructive">{t('members.remove')}</Text>
                    </Pressable>
                  ) : null}
                </HStack>
                <RoleChips
                  value={m.role ?? 'MEMBER'}
                  onChange={
                    canManage && !isSelf ? (role) => onChangeRole(m.user_id!, role) : undefined
                  }
                />
              </VStack>
            </View>
          );
        })}
      </VStack>
    </VStack>
  );
}

function InvitationsSection({ householdId }: { householdId: string }) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending, isError, errorKey } = useInviteForm(householdId);
  const { invitations } = useInvitations(householdId);
  const { onResend, onRevoke } = useInvitationActions(householdId);
  const { errors } = form.formState;
  const [role, setRole] = useState('MEMBER');

  const submit = () => {
    form.setValue('role', role as never);
    onSubmit();
  };

  return (
    <VStack space="md">
      <Heading size="md">{t('invitations.title')}</Heading>
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
      <Text className="text-sm font-medium">{t('invitations.roleLabel')}</Text>
      <RoleChips value={role} onChange={setRole} />
      <Button onPress={submit} isDisabled={isPending} className="self-start">
        {isPending ? <ButtonSpinner /> : null}
        <ButtonText>{t('invitations.send')}</ButtonText>
      </Button>

      <Heading size="sm" className="mt-2">
        {t('invitations.pending')}
      </Heading>
      {invitations.length === 0 ? (
        <Text className="text-sm text-muted-foreground">{t('invitations.none')}</Text>
      ) : (
        <VStack className="rounded-xl border border-border">
          {invitations.map((inv, i) => (
            <View key={inv.id}>
              {i > 0 ? <Divider /> : null}
              <HStack className="items-center justify-between p-4">
                <VStack className="flex-1">
                  <Text className="font-medium">{inv.email}</Text>
                  <Text className="text-sm text-muted-foreground">{t(`roles.${inv.role}`)}</Text>
                </VStack>
                <HStack space="md">
                  <Pressable onPress={() => onResend(inv.id!)}>
                    <Text className="text-sm text-primary">{t('invitations.resend')}</Text>
                  </Pressable>
                  <Pressable onPress={() => onRevoke(inv.id!)}>
                    <Text className="text-sm text-destructive">{t('invitations.revoke')}</Text>
                  </Pressable>
                </HStack>
              </HStack>
            </View>
          ))}
        </VStack>
      )}
    </VStack>
  );
}

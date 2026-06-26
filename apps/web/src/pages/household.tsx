/**
 * Household management page (`/household`): general settings, members, invitations.
 * Thin presentational shell over the household feature hooks; all logic lives in
 * `features/households/*`. Acts on the *active* household (the backend requires it).
 */
import { useGetMe, useListHouseholds } from '@homeops/api-client';
import { Loader2Icon, MailIcon, RefreshCwIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveHousehold } from '@/features/households/use-households';
import { useArchiveHouseholdAction, useRenameForm } from '@/features/households/use-household-admin';
import { useInvitationActions, useInvitations, useInviteForm } from '@/features/households/use-invitations';
import { useMemberActions, useMembers } from '@/features/households/use-members';

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CHILD'] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function HouseholdPage() {
  const { t } = useTranslation('households');
  const { activeHouseholdId, isOwner, canManageMembers } = useActiveHousehold();
  const { data: households } = useListHouseholds();

  // No active household → nothing to manage; send the user back to the dashboard onboarding.
  if (!activeHouseholdId) return <Navigate to="/" replace />;

  const active = (households?.households ?? []).find((h) => h.id === activeHouseholdId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{active?.name ?? t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('settings.tabs.general')}</TabsTrigger>
          <TabsTrigger value="members">{t('settings.tabs.members')}</TabsTrigger>
          {canManageMembers ? (
            <TabsTrigger value="invitations">{t('settings.tabs.invitations')}</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab
            householdId={activeHouseholdId}
            name={active?.name ?? ''}
            currency={active?.default_currency ?? 'HUF'}
            canManage={canManageMembers}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <MembersTab householdId={activeHouseholdId} canManage={canManageMembers} />
        </TabsContent>

        {canManageMembers ? (
          <TabsContent value="invitations" className="mt-4">
            <InvitationsTab householdId={activeHouseholdId} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

/* ── General ──────────────────────────────────────────────────────────────────── */

function GeneralTab({
  householdId,
  name,
  currency,
  canManage,
  isOwner,
}: {
  householdId: string;
  name: string;
  currency: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending } = useRenameForm(householdId, name, currency);
  const { errors } = form.formState;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.tabs.general')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="rename-name">{t('general.nameLabel')}</FieldLabel>
              <Input
                id="rename-name"
                disabled={!canManage}
                aria-invalid={!!errors.name}
                {...form.register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            {canManage ? (
              <Button type="submit" disabled={isPending} className="self-start">
                {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t('general.rename')}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {isOwner ? <DangerZone householdId={householdId} /> : null}
    </div>
  );
}

function DangerZone({ householdId }: { householdId: string }) {
  const { t } = useTranslation('households');
  const [open, setOpen] = useState(false);
  const { onArchive, isPending } = useArchiveHouseholdAction(householdId, () => setOpen(false));

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{t('general.dangerZone')}</CardTitle>
        <CardDescription>{t('general.archiveDescription')}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          {t('general.archive')}
        </Button>
      </CardFooter>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('general.archiveConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('general.archiveConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('general.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant="destructive" onClick={onArchive} disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t('general.archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ── Members ──────────────────────────────────────────────────────────────────── */

function MembersTab({ householdId, canManage }: { householdId: string; canManage: boolean }) {
  const { t } = useTranslation('households');
  const { data: me } = useGetMe();
  const { members, isLoading } = useMembers(householdId);
  const { onChangeRole, onRemove } = useMemberActions(householdId, me?.id);
  const [confirm, setConfirm] = useState<{ userId: string; self: boolean } | null>(null);

  if (isLoading) {
    return <Skeleton className="h-40 w-full max-w-xl" />;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t('members.title')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {members.map((m) => {
          const isSelf = m.user_id === me?.id;
          return (
            <div key={m.membership_id} className="flex items-center gap-3 py-3">
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">
                  {initials(m.display_name ?? m.email ?? '?')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{m.display_name}</span>
                  {isSelf ? (
                    <Badge variant="outline" className="text-xs">
                      {t('members.you')}
                    </Badge>
                  ) : null}
                </div>
                <span className="truncate text-sm text-muted-foreground">{m.email}</span>
              </div>

              {canManage && !isSelf ? (
                <RolePicker
                  value={m.role ?? 'MEMBER'}
                  onChange={(role) => onChangeRole(m.user_id!, role)}
                />
              ) : (
                <Badge variant="secondary">{t(`roles.${m.role}`)}</Badge>
              )}

              {isSelf ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm({ userId: m.user_id!, self: true })}
                >
                  {t('members.leave')}
                </Button>
              ) : canManage ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('members.remove')}
                  onClick={() => setConfirm({ userId: m.user_id!, self: false })}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(confirm?.self ? 'members.leaveConfirmTitle' : 'members.removeConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {t(confirm?.self ? 'members.leaveConfirmDescription' : 'members.removeConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t('general.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) onRemove(confirm.userId);
                setConfirm(null);
              }}
            >
              {t(confirm?.self ? 'members.leave' : 'members.remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RolePicker({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  const { t } = useTranslation('households');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {t(`roles.${value}`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {t(`roles.${r}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Invitations ──────────────────────────────────────────────────────────────── */

function InvitationsTab({ householdId }: { householdId: string }) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending } = useInviteForm(householdId);
  const { invitations, isLoading } = useInvitations(householdId);
  const { onResend, onRevoke } = useInvitationActions(householdId);
  const { errors } = form.formState;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('invitations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end" noValidate>
            <Field data-invalid={!!errors.email} className="flex-1">
              <FieldLabel htmlFor="invite-email">{t('invitations.emailLabel')}</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                placeholder={t('invitations.emailPlaceholder')}
                aria-invalid={!!errors.email}
                {...form.register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field className="sm:w-40">
              <FieldLabel htmlFor="invite-role">{t('invitations.roleLabel')}</FieldLabel>
              <select
                id="invite-role"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                {...form.register('role')}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t('invitations.send')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('invitations.pending')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : invitations.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailIcon />
                </EmptyMedia>
                <EmptyTitle>{t('invitations.none')}</EmptyTitle>
                <EmptyDescription>{t('invitations.none')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{inv.email}</div>
                    <div className="text-sm text-muted-foreground">{t(`roles.${inv.role}`)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('invitations.resend')}
                    onClick={() => onResend(inv.id!)}
                  >
                    <RefreshCwIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('invitations.revoke')}
                    onClick={() => onRevoke(inv.id!)}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The Security-tab "Devices" section: lists the user's active sessions with rename and
 * per-device / all-others sign-out. Presentational shell over `useDevices` — no business
 * logic here (feature plan §Device registration).
 */
import type { DeviceOut } from '@homeops/types';
import { MonitorIcon, MoreVerticalIcon, SmartphoneIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDevices } from '@/features/security/use-devices';

export function DevicesCard() {
  const { t } = useTranslation('settings');
  const { list, rename, revoke, revokeOthers } = useDevices();
  const devices = list.data?.devices ?? [];
  const hasOthers = devices.some((d) => !d.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorIcon className="size-5" />
          {t('devices.title')}
        </CardTitle>
        <CardDescription>{t('devices.description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {list.isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('devices.empty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                onRename={(name) => rename.mutate({ deviceId: device.id!, data: { name } })}
                onRevoke={() => revoke.mutate({ deviceId: device.id! })}
              />
            ))}
          </ul>
        )}
      </CardContent>

      {hasOthers ? (
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">{t('devices.signOutOthers')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('devices.signOutOthersTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('devices.signOutOthersDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('devices.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => revokeOthers.mutate()}>
                  {t('devices.confirmSignOut')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      ) : null}
    </Card>
  );
}

interface DeviceRowProps {
  device: DeviceOut;
  onRename: (name: string) => void;
  onRevoke: () => void;
}

function DeviceRow({ device, onRename, onRevoke }: DeviceRowProps) {
  const { t, i18n } = useTranslation('settings');
  const [renameOpen, setRenameOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const Icon = device.platform === 'web' ? MonitorIcon : SmartphoneIcon;
  const lastSeen = device.last_seen_at
    ? new Date(device.last_seen_at).toLocaleString(i18n.language)
    : '';

  return (
    <li className="flex items-center gap-3 p-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{device.name}</span>
          {device.current ? <Badge variant="default">{t('devices.thisDevice')}</Badge> : null}
          {device.trusted ? <Badge variant="secondary">{t('devices.trusted')}</Badge> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {t('devices.lastSeen', { time: lastSeen })}
          {device.last_ip ? ` · ${device.last_ip}` : ''}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label={device.name ?? ''}>
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            {t('devices.rename')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setRevokeOpen(true)}>
            {t('devices.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={device.name ?? ''}
        onRename={onRename}
      />

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('devices.signOutTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {device.current
                ? t('devices.signOutCurrentDescription')
                : t('devices.signOutDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('devices.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onRevoke}>{t('devices.confirmSignOut')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (name: string) => void;
}) {
  const { t } = useTranslation('settings');
  const [name, setName] = useState(currentName);

  const handleOpenChange = (next: boolean) => {
    if (next) setName(currentName);
    onOpenChange(next);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) onRename(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('devices.renameTitle')}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="device-name">{t('devices.nameLabel')}</FieldLabel>
          <Input
            id="device-name"
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('devices.cancel')}</Button>
          </DialogClose>
          <Button onClick={submit}>{t('devices.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

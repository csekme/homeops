/**
 * The Profile-tab avatar section (feature plan §Avatar, web §11): shows the current picture
 * (or initials), and lets the user pick a new one (→ circular crop dialog) or remove it.
 * Presentational shell over `useAvatar` + `AvatarCropDialog`.
 */
import { useGetMe } from '@homeops/api-client';
import { ImageIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { AvatarCropDialog } from './avatar-crop-dialog';
import { useAvatar } from './use-avatar';

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AvatarCard() {
  const { t } = useTranslation('settings');
  const { data: user } = useGetMe();
  const { upload, remove, isUploading, isRemoving } = useAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file fires onChange again.
    e.target.value = '';
    if (!file) return;
    setImageSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="size-5" />
          {t('profile.title')}
        </CardTitle>
        <CardDescription>{t('profile.description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex items-center gap-4">
        <Avatar size="lg" className="size-16">
          {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-base">{initials(user?.display_name)}</AvatarFallback>
        </Avatar>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t('profile.upload')}
            onChange={onPickFile}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {user?.avatar_url ? t('profile.change') : t('profile.upload')}
          </Button>

          {user?.avatar_url ? <RemoveButton remove={remove} isRemoving={isRemoving} /> : null}
        </div>
      </CardContent>

      <AvatarCropDialog
        imageSrc={imageSrc}
        onClose={closeCrop}
        onSave={upload}
        isSaving={isUploading}
      />
    </Card>
  );
}

function RemoveButton({
  remove,
  isRemoving,
}: {
  remove: () => Promise<boolean>;
  isRemoving: boolean;
}) {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={isRemoving}>
        <Trash2Icon className="size-4" />
        {t('profile.remove')}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('profile.removeTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('profile.removeDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await remove();
              setOpen(false);
            }}
          >
            {t('profile.remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

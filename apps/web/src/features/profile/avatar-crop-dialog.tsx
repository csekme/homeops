/**
 * Circular crop + zoom dialog (feature plan §Avatar, web §10). Wraps react-easy-crop with a
 * round viewport and a zoom slider; on save it rasterises the positioned crop to a square
 * Blob and hands it to `useAvatar().upload`. Presentational — all mutation logic is in the hook.
 */
import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

import { getCroppedBlob, type PixelCrop } from './get-cropped-img';

interface AvatarCropDialogProps {
  /** Object URL of the picked image; null keeps the dialog closed. */
  imageSrc: string | null;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<boolean>;
  isSaving: boolean;
}

export function AvatarCropDialog({ imageSrc, onClose, onSave, isSaving }: AvatarCropDialogProps) {
  const { t } = useTranslation('settings');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<PixelCrop | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPixels(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      onClose();
    }
  };

  const handleSave = async () => {
    if (!imageSrc || !pixels) return;
    const blob = await getCroppedBlob(imageSrc, pixels);
    const ok = await onSave(blob);
    if (ok) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={imageSrc !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.cropTitle')}</DialogTitle>
          <DialogDescription>{t('profile.cropInstruction')}</DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full overflow-hidden rounded-md bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{t('profile.zoom')}</span>
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v ?? 1)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            {t('profile.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !pixels}>
            {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('profile.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

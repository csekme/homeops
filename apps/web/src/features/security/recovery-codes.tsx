/** Presentational one-time recovery-codes block: copy + download + "I saved them". */
import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
  const { t } = useTranslation('settings');
  const [copied, setCopied] = useState(false);

  const asText = codes.join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(asText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([`${asText}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'homeops-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertDescription>{t('twofactor.recovery.warning')}</AlertDescription>
      </Alert>

      <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          {copied ? t('twofactor.recovery.copied') : t('twofactor.recovery.copy')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <DownloadIcon className="size-4" />
          {t('twofactor.recovery.download')}
        </Button>
      </div>

      {onDone ? (
        <Button type="button" onClick={onDone} className="self-start">
          {t('twofactor.recovery.confirmSaved')}
        </Button>
      ) : null}
    </div>
  );
}

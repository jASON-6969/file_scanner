import { FilePlus2 } from 'lucide-react';
import { useRef } from 'react';

interface FileImportButtonProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function FileImportButton({ onFiles, disabled, compact }: FileImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className={compact ? 'button secondary icon-command' : 'button secondary'} onClick={() => inputRef.current?.click()} disabled={disabled}>
        <FilePlus2 size={18} />
        <span>{compact ? 'Import' : 'Import images or PDF'}</span>
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,.doc,.docx,.ppt,.pptx"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = '';
        }}
      />
    </>
  );
}

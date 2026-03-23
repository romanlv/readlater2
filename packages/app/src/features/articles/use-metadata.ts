import { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/features/settings/use-settings';

interface Metadata {
  title: string;
  description: string;
  featuredImage: string;
  domain: string;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function useMetadata(url: string) {
  const { settings } = useSettings();
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!settings.backendEnabled || !settings.backendUrl || !isValidUrl(url)) {
      setMetadata(null);
      setIsLoading(false);
      return;
    }

    const debounce = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const res = await fetch(`${settings.backendUrl}/api/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setMetadata(null);
          return;
        }

        const data: Metadata = await res.json();
        if (!controller.signal.aborted) {
          setMetadata(data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMetadata(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(debounce);
      abortRef.current?.abort();
    };
  }, [url, settings.backendEnabled, settings.backendUrl]);

  return { metadata, isLoading };
}

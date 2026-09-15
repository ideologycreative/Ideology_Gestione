'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { safeUrl } from '@/lib/utils';
import type { Database, Slide } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['content_items']['Row'];

/** Ported from legacy/src/app/views.js's thumb() — one card component across every view. */
export function Thumb({ item, ratio }: { item: ItemRow; ratio: string }) {
  const [broken, setBroken] = useState(false);
  const url = safeUrl(item.url || item.external_url);

  return (
    <div className="thumb" data-type={item.type} style={{ aspectRatio: ratio.replace('/', ' / ') }}>
      {url && !broken ? (
        <img src={url} alt={item.copy ? item.copy.slice(0, 60) : ''} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="thumb--empty" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="image" size={18} />
        </div>
      )}
      {item.type === 'carousel' && (
        <span className="thumb-tag">
          CAR {(item.slides as Slide[])?.length || ''}
          {(item.slides as Slide[])?.[0]?.videoUrl ? ' ▶' : ''}
        </span>
      )}
      {item.type === 'reel' && <span className="thumb-tag">REEL</span>}
      {item.kind === 'story' && <span className="thumb-tag thumb-tag--l">STORY</span>}
      {item.sponsored && <span className="thumb-spon">SPONSOR</span>}
    </div>
  );
}

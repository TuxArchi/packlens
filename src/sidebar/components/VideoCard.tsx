import { useEffect, useState } from 'preact/hooks';
import { formatAge, formatCompact, formatDuration } from '../../core/format';
import { t } from '../../core/i18n';
import type { VideoData } from '../../core/types';

function thumbnailFallback(videoId: string | null): string | null {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

export function VideoCard({ data }: { data: VideoData }) {
  const [src, setSrc] = useState<string | null>(data.thumbnailUrl);

  useEffect(() => {
    setSrc(data.thumbnailUrl);
  }, [data.thumbnailUrl]);

  const meta: string[] = [];
  if (data.views != null) meta.push(`${formatCompact(data.views)} ${t('metric.views').toLowerCase()}`);
  const age = formatAge(data.publishedAt);
  if (age) meta.push(age);
  const duration = formatDuration(data.lengthSeconds);
  if (duration) meta.push(duration);

  return (
    <section class="card video-card">
      {src ? (
        <img
          class="thumb"
          src={src}
          alt=""
          onError={() => {
            const fallback = thumbnailFallback(data.videoId);
            setSrc(fallback && fallback !== src ? fallback : null);
          }}
        />
      ) : (
        <div class="thumb thumb-empty" aria-hidden="true" />
      )}

      <div>
        <h1 class="video-title">{data.title || t('metric.noData')}</h1>
        {data.channel && <p class="video-meta">{data.channel}</p>}
        {meta.length > 0 && <p class="video-meta">{meta.join(' · ')}</p>}
      </div>
    </section>
  );
}

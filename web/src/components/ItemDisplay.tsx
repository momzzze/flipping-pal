import type { Item, ItemQuality } from '@/lib/types'
import { QUALITY_TEXT } from '@/lib/quality'
import { cn } from '@/lib/utils'

const QUALITY_BORDER: Record<ItemQuality, string> = {
  POOR: 'border-q-poor/60',
  COMMON: 'border-q-common/40',
  UNCOMMON: 'border-q-uncommon/60',
  RARE: 'border-q-rare/70',
  EPIC: 'border-q-epic/70',
  LEGENDARY: 'border-q-legendary/70',
  ARTIFACT: 'border-q-artifact/70',
  HEIRLOOM: 'border-q-heirloom/70',
  UNKNOWN: 'border-border',
}

export function ItemIcon({ item, size = 28 }: { item: Pick<Item, 'name' | 'iconUrl' | 'quality'> | null; size?: number }) {
  const quality = item?.quality ?? 'UNKNOWN'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded border-2 bg-muted', QUALITY_BORDER[quality])}
      style={{ width: size, height: size }}
    >
      {item?.iconUrl ? (
        <img src={item.iconUrl} alt="" width={size} height={size} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className={cn('text-[0.65rem] font-bold', QUALITY_TEXT[quality])}>
          {item ? item.name.replace(/^\[Sample\]\s*/, '').slice(0, 2).toUpperCase() : '?'}
        </span>
      )}
    </span>
  )
}

export function ItemName({ item, className }: { item: Pick<Item, 'name' | 'quality' | 'craftingQuality'>; className?: string }) {
  return (
    <span className={cn('font-medium', QUALITY_TEXT[item.quality], className)}>
      {item.name}
      {item.craftingQuality ? (
        <span className="ml-1 text-xs text-warning" title={`Crafting quality rank ${item.craftingQuality}`}>
          {'★'.repeat(item.craftingQuality)}
        </span>
      ) : null}
    </span>
  )
}

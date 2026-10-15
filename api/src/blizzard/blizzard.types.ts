/** Minimal typings for the parts of the WoW Game Data API that Azeroth Flip consumes. */

export interface BlizzardRef {
  id: number;
  name?: string;
}

export interface BlizzardKeyRef {
  href: string;
}

export interface BlizzardTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CommodityAuction {
  id: number;
  item: { id: number };
  quantity: number;
  unit_price: number;
  time_left?: string;
}

export interface CommodityAuctionsResponse {
  auctions: CommodityAuction[];
}

export interface RealmAuction {
  id: number;
  item: { id: number; bonus_lists?: number[] };
  quantity: number;
  unit_price?: number;
  buyout?: number;
  bid?: number;
  time_left?: string;
}

export interface RealmAuctionsResponse {
  auctions?: RealmAuction[];
}

export interface ProfessionIndexResponse {
  professions: BlizzardRef[];
}

export interface ProfessionResponse {
  id: number;
  name: string;
  skill_tiers?: BlizzardRef[];
}

export interface SkillTierResponse {
  id: number;
  name: string;
  minimum_skill_level?: number;
  maximum_skill_level?: number;
  categories?: Array<{ name: string; recipes?: BlizzardRef[] }>;
}

export interface RecipeResponse {
  id: number;
  name: string;
  crafted_item?: BlizzardRef;
  alliance_crafted_item?: BlizzardRef;
  horde_crafted_item?: BlizzardRef;
  reagents?: Array<{ reagent: BlizzardRef; quantity: number }>;
  modified_crafting_slots?: Array<{
    slot_type?: { id: number; name?: string };
    display_order?: number;
  }>;
  crafted_quantity?: { value?: number; minimum?: number; maximum?: number };
}

export interface ItemResponse {
  id: number;
  name: string;
  quality?: { type: string; name?: string };
  item_class?: BlizzardRef;
  item_subclass?: BlizzardRef;
  purchase_price?: number;
  sell_price?: number;
}

export interface MediaResponse {
  assets?: Array<{ key: string; value: string }>;
}

export interface ConnectedRealmIndexResponse {
  connected_realms: BlizzardKeyRef[];
}

export interface ConnectedRealmResponse {
  id: number;
  realms: Array<{ id: number; name: string; slug: string }>;
}

export interface ConditionalResult<T> {
  /** null when the server answered 304 Not Modified. */
  data: T | null;
  lastModified: Date | null;
}

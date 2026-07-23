import slugToDex from "../../../shared/slug_to_dex.json";
import huntsData from "../../../shared/hunts_data.json";
import pokeBaseStats from "../../../shared/poke_base_stats.json";
import itemsData from "../../../shared/items_data.json";

export async function loadJSON<T = any>(filename: string): Promise<T> {
  if (filename === "slug_to_dex.json") return slugToDex as unknown as T;
  if (filename === "hunts_data.json") return { hunts: huntsData } as unknown as T;
  if (filename === "poke_base_stats.json") return pokeBaseStats as unknown as T;
  if (filename === "items_data.json") return itemsData as unknown as T;
  return null as unknown as T;
}


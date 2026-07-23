import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "../../lib/ipc";
import { loadJSON } from "../../lib/dataLoader";
import { RARITIES, RARITY_COLORS, TIER_COLORS, getRarity, getTier } from "../../lib/rarity";
import type { Rarity } from "../../lib/rarity";
import { Lock, Unlock, Star, Sparkles, Shield, Zap, Swords, Wind, ShoppingCart, Filter, CheckSquare, Square, RotateCw, LayoutGrid, List } from "lucide-react";

interface Props {
  accountName: string;
  onRefresh: () => void;
}

export function MyPokemonPanel({ accountName, onRefresh }: Props) {
  const [pokemon, setPokemon] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dexMap, setDexMap] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selling, setSelling] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filters
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(new Set());
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [minIv, setMinIv] = useState("");
  const [maxIv, setMaxIv] = useState("");
  const [shinyOnly, setShinyOnly] = useState(false);

  const [sortBy, setSortBy] = useState<"score" | "level" | "rarity">("score");

  const loadPokemon = useCallback(() => {
    setLoading(true);
    invoke<any[]>("bot:get-all-pokemon", accountName).then((data) => {
      setPokemon(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accountName]);

  useEffect(() => {
    loadPokemon();
    loadJSON<Record<string, number>>("slug_to_dex.json").then(setDexMap);
  }, [accountName, loadPokemon]);

  const filteredPokemon = useMemo(() => {
    let result = pokemon.filter((p) => {
      if (rarityFilter.size > 0 && !rarityFilter.has(getRarity(p))) return false;
      if (minScore && (p.score ?? 0) < Number(minScore)) return false;
      if (maxScore && (p.score ?? 0) > Number(maxScore)) return false;
      if (minIv && (p.ivTotal ?? 0) < Number(minIv)) return false;
      if (maxIv && (p.ivTotal ?? 0) > Number(maxIv)) return false;
      if (shinyOnly && !p.shiny) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "score") {
        const scoreA = a.score ?? ((a.quality || 0) * (a.ivTotal || 0));
        const scoreB = b.score ?? ((b.quality || 0) * (b.ivTotal || 0));
        return scoreB - scoreA;
      }
      if (sortBy === "level") return (b.level ?? b.lv ?? 0) - (a.level ?? a.lv ?? 0);
      if (sortBy === "rarity") return (b.quality || 0) - (a.quality || 0);
      return 0;
    });

    return result;
  }, [pokemon, rarityFilter, minScore, maxScore, minIv, maxIv, shinyOnly, sortBy]);

  const toggleSelectFilter = () => {
    const allSelected = filteredPokemon.every(p => selectedIds.has(String(p.id)));
    const ids = new Set(selectedIds);
    if (allSelected) {
      for (const p of filteredPokemon) {
        ids.delete(String(p.id));
      }
    } else {
      for (const p of filteredPokemon) {
        ids.add(String(p.id));
      }
    }
    setSelectedIds(ids);
  };

  const deselectAll = () => setSelectedIds(new Set());

  const togglePokemon = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkSell = async () => {
    if (selectedIds.size === 0 || selling) return;
    setSelling(true);
    try {
      await invoke("bot:sell-pokemon", accountName, Array.from(selectedIds));
      setSelectedIds(new Set());
      loadPokemon();
      onRefresh();
    } finally {
      setSelling(false);
    }
  };

  const bulkEvolve = async () => {
    if (selectedIds.size === 0 || evolving) return;
    setEvolving(true);
    try {
      await invoke("bot:evolve-pokemon-mass", accountName, Array.from(selectedIds), true);
      setSelectedIds(new Set());
      loadPokemon();
      onRefresh();
    } finally {
      setEvolving(false);
    }
  };

  const toggleLock = async (id: string) => {
    await invoke("bot:toggle-lock-pokemon", accountName, id);
    loadPokemon();
  };

  const evolvePokemon = async (id: string) => {
    await invoke("bot:evolve-pokemon", accountName, id, true);
    loadPokemon();
    onRefresh();
  };

  const setLeader = async (id: string) => {
    await invoke("bot:set-leader", accountName, id);
    loadPokemon();
    onRefresh();
  };

  const toggleRarity = (r: Rarity) => {
    setRarityFilter((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  };

  const getSprite = (p: any) => {
    const slug = (p.slug || p.name || "").toLowerCase().replace(/^(furious|brave|ancient|elder|evil|dark|psy|hard|brute|trickmaster|banshee|enchanted|tactical|magnetic|freezing|heavy|roll|charged|tribal|war|enigmatic|enraged|taekwondo)[\s_]+/g, "").replace(/^milch-/, "").trim();
    const dex = dexMap[slug] || dexMap[p.slug?.toLowerCase()] || dexMap[p.name?.toLowerCase()] || 0;
    if (dex > 0) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${dex}.gif`;
    if (dex > 0) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`;
    return "";
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[rgb(var(--text-primary))]">
          <span>Meus Pokemon</span>
          <span className="text-[12px] font-normal text-[rgb(var(--text-muted))]">{accountName}</span>
        </h1>
        <div className="flex items-center gap-2">
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] text-[11px] px-2 py-1.5 rounded-lg focus:outline-none"
          >
            <option value="score">Maior Score</option>
            <option value="level">Maior Level</option>
            <option value="rarity">Maior Raridade</option>
          </select>
          <button onClick={loadPokemon} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] border border-[rgb(var(--border))] transition-colors">
            <RotateCw size={12} /> Atualizar
          </button>
          <div className="flex border border-[rgb(var(--border))] rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`flex items-center gap-1 px-2 py-1.5 text-[11px] transition-colors ${viewMode === "grid" ? "bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]" : "bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"}`}>
              <LayoutGrid size={12} />
            </button>
            <button onClick={() => setViewMode("list")} className={`flex items-center gap-1 px-2 py-1.5 text-[11px] transition-colors ${viewMode === "list" ? "bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]" : "bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"}`}>
              <List size={12} />
            </button>
          </div>
          <button onClick={toggleSelectFilter} disabled={filteredPokemon.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/25 disabled:opacity-40 transition-colors">
            <CheckSquare size={12} /> Selecionar por Filtros ({filteredPokemon.length})
          </button>
          <button onClick={bulkSell} disabled={selectedIds.size === 0 || selling || evolving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-colors">
            <ShoppingCart size={12} /> Vender Selecionados ({selectedIds.size})
          </button>
          <button onClick={bulkEvolve} disabled={selectedIds.size === 0 || selling || evolving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40 transition-colors">
            <Zap size={12} /> Evoluir ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--text-muted))] font-semibold uppercase tracking-wider">
          <Filter size={12} /> Filtros
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <div className="text-[10px] text-[rgb(var(--text-faint))]">Raridade</div>
            <div className="flex gap-1 flex-wrap">
              {RARITIES.map((r) => (
                <label key={r} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer border transition-colors select-none ${rarityFilter.has(r) ? RARITY_COLORS[r] : "text-[rgb(var(--text-faint))] border-transparent hover:border-[rgb(var(--border))]"}`}>
                  <input type="checkbox" checked={rarityFilter.has(r)} onChange={() => toggleRarity(r)} className="sr-only" />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-[rgb(var(--text-faint))]">Score</div>
            <div className="flex items-center gap-1">
              <input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Min" className={filterInput} />
              <span className="text-[rgb(var(--text-faint))] text-[10px]">-</span>
              <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="Max" className={filterInput} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-[rgb(var(--text-faint))]">IV (0-192)</div>
            <div className="flex items-center gap-1">
              <input type="number" value={minIv} onChange={(e) => setMinIv(e.target.value)} placeholder="Min" className={filterInput} />
              <span className="text-[rgb(var(--text-faint))] text-[10px]">-</span>
              <input type="number" value={maxIv} onChange={(e) => setMaxIv(e.target.value)} placeholder="Max" className={filterInput} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-[rgb(var(--text-faint))]">Shiny</div>
            <button onClick={() => setShinyOnly(!shinyOnly)} className={`flex items-center gap-1 px-3 py-1 rounded text-[10px] font-medium border transition-colors ${shinyOnly ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" : "text-[rgb(var(--text-faint))] border-transparent hover:border-[rgb(var(--border))]"}`}>
              <Sparkles size={11} /> Shiny
            </button>
          </div>
          {selectedIds.size > 0 && (
            <button onClick={deselectAll} className="px-3 py-1 rounded text-[10px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] border border-[rgb(var(--border))] transition-colors">
              Limpar Selecao
            </button>
          )}
        </div>
      </div>

      {/* Pokemon display */}
      {loading ? (
        <div className="text-center py-12 text-[rgb(var(--text-muted))] text-[13px]">Carregando Pokemon...</div>
      ) : filteredPokemon.length === 0 ? (
        <div className="text-center py-12 text-[rgb(var(--text-faint))] text-[13px]">
          {pokemon.length === 0 ? "Nenhum Pokemon encontrado." : "Nenhum Pokemon bate nos filtros."}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {filteredPokemon.map((p) => {
            const id = String(p.id);
            const sel = selectedIds.has(id);
            const rarity = getRarity(p);
            const tier = getTier(p);
            const ivPct = Math.min(100, ((p.ivTotal ?? 0) / 192) * 100);

            return (
              <div key={id} className={`relative bg-[rgb(var(--bg-base))] border rounded-lg p-2 cursor-pointer transition-all ${sel ? "border-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]/30" : "border-[rgb(var(--border))] hover:border-[rgb(var(--text-faint))]"}`}
                onClick={() => togglePokemon(id)}>
                {/* Header: sprite + name */}
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="w-10 h-10 shrink-0 bg-[rgb(var(--bg-surface))]/50 rounded flex items-center justify-center overflow-hidden">
                    {getSprite(p) ? (
                      <img src={getSprite(p)} alt={p.name || p.slug} className="w-9 h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <span className="text-[14px]">?</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-semibold text-[rgb(var(--text-primary))] truncate capitalize">{p.name || p.slug || `#${p.id}`}</span>
                      {p.shiny && <Sparkles size={10} className="text-yellow-400 shrink-0" />}
                    </div>
                    <div className="text-[9px] text-[rgb(var(--text-faint))]">Lv.{p.level ?? "?"}</div>
                  </div>
                </div>

                {/* Tier / Rarity badge */}
                <div className="flex items-center gap-1 mb-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[tier] || TIER_COLORS.D}`}>Tier {tier}</span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${RARITY_COLORS[rarity]}`}>{rarity}</span>
                </div>

                {/* IV bar */}
                <div className="mb-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-[rgb(var(--text-faint))]">IV Total</span>
                    <span className="text-[9px] text-[rgb(var(--text-muted))]">{p.ivTotal ?? 0}/192</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[rgb(var(--bg-elevated))] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ivPct}%`, background: ivPct >= 80 ? "#facc15" : ivPct >= 50 ? "#60a5fa" : ivPct >= 30 ? "#a3a3a3" : "#525252" }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] mb-1">
                  <div className="flex items-center gap-1 text-[rgb(var(--text-muted))]"><Swords size={8} className="text-orange-400" />{p.atk ?? 0}</div>
                  <div className="flex items-center gap-1 text-[rgb(var(--text-muted))]"><Shield size={8} className="text-blue-400" />{p.def ?? 0}</div>
                  <div className="flex items-center gap-1 text-[rgb(var(--text-muted))]"><Zap size={8} className="text-yellow-400" />{p.spd ?? 0}</div>
                  <div className="flex items-center gap-1 text-[rgb(var(--text-muted))]"><span className="w-2 h-2 rounded-full bg-red-500/80" />{p.hp ?? 0}</div>
                </div>

                {/* Quality / Power / Score */}
                <div className="flex items-center gap-2 text-[9px] text-[rgb(var(--text-faint))] mb-1">
                  {p.quality != null && <span>Q: {p.quality}</span>}
                  {p.power != null && <span>P: {p.power}</span>}
                  {p.score != null && <span className="text-[rgb(var(--text-muted))]">S: {p.score}</span>}
                </div>

                {/* Bottom row: equip + lock + select indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setLeader(id); }} className="text-[rgb(var(--text-faint))] hover:text-green-400 transition-colors" title="Definir Lider">
                      <Swords size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleLock(id); }} className="text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-secondary))] transition-colors" title={p.locked ? "Desbloquear" : "Bloquear"}>
                      {p.locked ? <Lock size={12} className="text-amber-400" /> : <Unlock size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); evolvePokemon(id); }} className="text-[rgb(var(--text-faint))] hover:text-purple-400 transition-colors" title="Evoluir">
                      <Zap size={12} />
                    </button>
                  </div>
                  <div className="w-4 h-4 rounded border flex items-center justify-center transition-colors" style={{ borderColor: sel ? "rgb(var(--accent))" : "rgb(var(--border))", background: sel ? "rgb(var(--accent))" : "transparent" }}>
                    {sel && <span className="text-[8px] text-[rgb(var(--bg-deep))] font-bold">✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] rounded-lg overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-[rgb(var(--bg-surface))]">
              <tr className="text-left text-[rgb(var(--text-muted))]">
                <th className="px-3 py-1.5 font-medium">Sprite</th>
                <th className="px-3 py-1.5 font-medium">Nome</th>
                <th className="px-3 py-1.5 font-medium">Level</th>
                <th className="px-3 py-1.5 font-medium">Tier</th>
                <th className="px-3 py-1.5 font-medium">Raridade</th>
                <th className="px-3 py-1.5 font-medium">IV Total</th>
                <th className="px-3 py-1.5 font-medium">Score</th>
                <th className="px-3 py-1.5 font-medium">Quality</th>
                <th className="px-3 py-1.5 font-medium">Equipar</th>
                <th className="px-3 py-1.5 font-medium">Lock</th>
                <th className="px-3 py-1.5 font-medium">Evoluir</th>
                <th className="px-3 py-1.5 font-medium">Select</th>
              </tr>
            </thead>
            <tbody>
              {filteredPokemon.map((p) => {
                const id = String(p.id);
                const sel = selectedIds.has(id);
                const rarity = getRarity(p);
                const tier = getTier(p);

                return (
                  <tr key={id} onClick={() => togglePokemon(id)}
                    className={`border-t border-[rgb(var(--border))] cursor-pointer transition-colors ${sel ? "bg-[rgb(var(--accent))]/10" : "hover:bg-[rgb(var(--bg-surface))]/30"}`}>
                    <td className="px-3 py-1.5">
                      {getSprite(p) ? (
                        <img src={getSprite(p)} alt={p.name || p.slug} className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <span className="text-[12px]">?</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[rgb(var(--text-primary))] font-medium capitalize">
                      <span className="flex items-center gap-1">
                        {p.name || p.slug || `#${p.id}`}
                        {p.shiny && <Sparkles size={10} className="text-yellow-400" />}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-[rgb(var(--text-secondary))]">{p.level ?? "?"}</td>
                    <td className="px-3 py-1.5"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[tier] || TIER_COLORS.D}`}>{tier}</span></td>
                    <td className="px-3 py-1.5"><span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${RARITY_COLORS[rarity]}`}>{rarity}</span></td>
                    <td className="px-3 py-1.5 text-[rgb(var(--text-muted))]">{p.ivTotal ?? 0}/192</td>
                    <td className="px-3 py-1.5 text-[rgb(var(--text-muted))]">{p.score ?? "-"}</td>
                    <td className="px-3 py-1.5 text-[rgb(var(--text-muted))]">{p.quality ?? "-"}</td>
                    <td className="px-3 py-1.5">
                      <button onClick={(e) => { e.stopPropagation(); setLeader(id); }} className="text-[rgb(var(--text-faint))] hover:text-green-400 transition-colors" title="Definir Lider">
                        <Swords size={12} />
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={(e) => { e.stopPropagation(); toggleLock(id); }} className="text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-secondary))] transition-colors" title={p.locked ? "Desbloquear" : "Bloquear"}>
                        {p.locked ? <Lock size={12} className="text-amber-400" /> : <Unlock size={12} />}
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={(e) => { e.stopPropagation(); evolvePokemon(id); }} className="text-[rgb(var(--text-faint))] hover:text-purple-400 transition-colors" title="Evoluir">
                        <Zap size={12} />
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="w-4 h-4 rounded border flex items-center justify-center transition-colors" style={{ borderColor: sel ? "rgb(var(--accent))" : "rgb(var(--border))", background: sel ? "rgb(var(--accent))" : "transparent" }}>
                        {sel && <span className="text-[8px] text-[rgb(var(--bg-deep))] font-bold">✓</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const filterInput = "w-16 px-1.5 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[10px] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-faint))] focus:outline-none focus:border-[rgb(var(--accent))] transition-colors";

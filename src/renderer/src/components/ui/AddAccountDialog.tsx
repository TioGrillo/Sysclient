import { useState, useEffect } from "react";
import type { AccountConfig } from "../../types";
import { createDefaultAccount } from "../../types";
import { HuntSelector } from "./HuntSelector";
import { loadJSON } from "../../lib/dataLoader";
import { X, ChevronRight } from "lucide-react";

interface AddAccountDialogProps {
  onAdd: (account: AccountConfig) => void;
  onClose: () => void;
}

function getSpriteUrl(slug: string, dexMap: Record<string, number>): string {
  const clean = slug.toLowerCase().replace(/^(furious|brave|ancient|elder|evil|dark|psy|hard|brute|trickmaster|banshee|enchanted|tactical|magnetic|freezing|heavy|roll|charged|tribal|war|enigmatic|enraged|taekwondo)[\s_]+/g, "").replace(/^milch-/, "").trim();
  const dex = dexMap[clean] || dexMap[slug.toLowerCase()] || 0;
  if (dex > 0) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${dex}.gif`;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`;
}

export function AddAccountDialog({ onAdd, onClose }: AddAccountDialogProps) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [hunt, setHunt] = useState("pidgey");
  const [showHuntSelector, setShowHuntSelector] = useState(false);
  const [dexMap, setDexMap] = useState<Record<string, number>>({});
  const [huntsData, setHuntsData] = useState<any[]>([]);

  useEffect(() => {
    loadJSON<Record<string, number>>("slug_to_dex.json").then(setDexMap);
    loadJSON<{ hunts: any[] }>("hunts_data.json").then((d) => setHuntsData(d.hunts || []));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token.trim()) return;
    onAdd(createDefaultAccount(name.trim(), token.trim(), hunt));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] rounded-xl w-[520px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border))]">
          <h2 className="text-[15px] font-semibold text-[rgb(var(--text-primary))]">Adicionar Conta</h2>
          <button onClick={onClose} className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-secondary))] transition-colors"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] text-[rgb(var(--text-muted))] mb-1">Nome da Conta</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Conta1"
              className="w-full px-3 py-2 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[13px] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-faint))] focus:outline-none focus:border-[rgb(var(--accent))] transition-colors" />
          </div>
          <div>
            <label className="block text-[12px] text-[rgb(var(--text-muted))] mb-1">Token JWT</label>
            <textarea value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token JWT aqui..." rows={3}
              className="w-full px-3 py-2 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[13px] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-faint))] focus:outline-none focus:border-[rgb(var(--accent))] transition-colors resize-none font-mono text-[11px]" />
          </div>
          <div>
            <label className="block text-[12px] text-[rgb(var(--text-muted))] mb-1">Hunt</label>
            <div onClick={() => setShowHuntSelector(true)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] cursor-pointer hover:border-[rgb(var(--accent))] transition-colors">
              <img src={getSpriteUrl(hunt, dexMap)} alt={hunt} className="w-10 h-10 object-contain"
                onError={(e) => { const dex = dexMap[hunt.toLowerCase()] || 0; (e.target as HTMLImageElement).src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`; }} />
              <div className="flex-1">
                <div className="text-[13px] text-[rgb(var(--text-primary))] capitalize">{hunt}</div>
                <div className="text-[11px] text-[rgb(var(--text-muted))]">Clique para selecionar</div>
              </div>
              <ChevronRight size={14} className="text-[rgb(var(--text-faint))]" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-md text-[13px] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-surface))] transition-colors">Cancelar</button>
            <button type="submit" disabled={!name.trim() || !token.trim()}
              className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-[rgb(var(--accent))] text-[rgb(var(--bg-deep))] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Adicionar</button>
          </div>
        </form>
      </div>
      {showHuntSelector && <HuntSelector hunts={huntsData} currentHunt={hunt} onSelect={(s) => { setHunt(s); setShowHuntSelector(false); }} onClose={() => setShowHuntSelector(false)} />}
    </div>
  );
}

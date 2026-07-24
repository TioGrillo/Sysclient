import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, on } from "../../lib/ipc";
import { createDefaultAccount } from "../../types";
import {
  UserPlus, RefreshCw, Trash2, Eye, EyeOff, CheckCircle2,
  XCircle, Clock, Download, ChevronDown, ChevronUp, Key, Search, Filter, Globe, Edit2, X
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
export interface RegisteredAccount {
  id: string;
  login: string;
  password: string;
  nick: string;
  trainerName: string;
  token: string;
  registeredAt: number;
  lastLoginAt?: number;
  status: "ok" | "error" | "pending" | "refreshing";
  errorMsg?: string;
  addedToBot: boolean;
  restoreKey?: string;
  starterId?: number;
  gender?: string;
}

interface RegisterConfig {
  count: number;
  password: string;
  prefix: string;
  usePrefix: boolean;
  avoidNumbers: boolean;
  starterId: number;
  gender: string;
}

interface BrowserProgress {
  current: number;
  total: number;
  nick: string;
  action: string;
  result?: {
    login: string;
    nick: string;
    success: boolean;
    token: string;
    message: string;
  };
}

type SortKey = "registeredAt" | "nick" | "status" | "lastLoginAt";
type FilterStatus = "all" | "ok" | "error" | "pending";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtDate(ts?: number) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function maskToken(t: string) {
  if (!t) return "—";
  return t.slice(0, 12) + "..." + t.slice(-8);
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export function RegisterBot({ onAccountsChanged }: { onAccountsChanged?: () => void }) {
  const [history, setHistory] = useState<RegisteredAccount[]>([]);

  // ── Form
  const [genCount, setGenCount] = useState(Number(localStorage.getItem("rb_count")) || 1);
  const [genPassword, setGenPassword] = useState(localStorage.getItem("rb_pass") || "Vd522431");
  const [genPrefix, setGenPrefix] = useState(localStorage.getItem("rb_prefix") || "Player");
  const [usePrefix, setUsePrefix] = useState(localStorage.getItem("rb_usePrefix") !== "false");
  const [avoidNumbers, setAvoidNumbers] = useState(localStorage.getItem("rb_avoidNum") === "true");
  const [genStarter, setGenStarter] = useState(localStorage.getItem("rb_starter") || "7");
  const [genGender, setGenGender] = useState(localStorage.getItem("rb_gender") || "random");
  const [delayMs, setDelayMs] = useState(Number(localStorage.getItem("rb_delay")) || 2000);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<RegisterConfig>({
    count: 1,
    password: "",
    prefix: "",
    usePrefix: false,
    avoidNumbers: false,
    starterId: 7,
    gender: "random"
  });

  const [editingEntry, setEditingEntry] = useState<RegisteredAccount | null>(null);
  const [editLogin, setEditLogin] = useState("");
  const [editNick, setEditNick] = useState("");

  function openEditModal(entry: RegisteredAccount) {
    setEditingEntry(entry);
    setEditLogin(entry.login);
    setEditNick(entry.nick);
  }

  function saveEdit() {
    if (!editingEntry) return;
    setHistory((prev) => {
      const next = prev.map((h) =>
        h.id === editingEntry.id ? { ...h, login: editLogin, nick: editNick, trainerName: editNick } : h
      );
      invoke("regbot:history-save", next);
      return next;
    });
    setEditingEntry(null);
  }; 
  const [runLog, setRunLog] = useState<{ msg: string; type: "ok" | "err" | "info" }[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── UI state
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [showRestoreKeys, setShowRestoreKeys] = useState<Record<string, boolean>>({});
  const [showGenPassword, setShowGenPassword] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("registeredAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    // FIX SCRIPT: arrumar emails das contas importadas
    invoke("regbot:history-get").then((h: any[]) => {
      if (!Array.isArray(h)) return;
      let changed = false;
      const next = [...h];
      for (const a of next) {
        if (a.login === "snipermage92459901@uorak.com" && a.nick !== "snipermage92459901") {
          a.login = a.nick + "@uorak.com";
          changed = true;
        }
      }
      if (changed) {
        invoke("regbot:history-save", next).then(() => {
          setHistory(next);
        });
      } else {
        setHistory(next);
      }
    });

    invoke("accounts:list").then((accs: any[]) => {
      if (Array.isArray(accs)) {
        let changed = false;
        const next = [...accs];
        for (const a of next) {
          if (a.email === "snipermage92459901@uorak.com" && a.name !== "snipermage92459901") {
            a.email = a.name + "@uorak.com";
            changed = true;
          }
        }
        if (changed) {
          invoke("accounts:save", next);
        }
      }
    });
  }, []);

  // Auto scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runLog]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("rb_count", String(genCount));
    localStorage.setItem("rb_pass", genPassword);
    localStorage.setItem("rb_prefix", genPrefix);
    localStorage.setItem("rb_usePrefix", String(usePrefix));
    localStorage.setItem("rb_avoidNum", String(avoidNumbers));
    localStorage.setItem("rb_starter", genStarter);
    localStorage.setItem("rb_gender", genGender);
    localStorage.setItem("rb_delay", String(delayMs));
  }, [genCount, genPassword, genPrefix, usePrefix, avoidNumbers, genStarter, genGender, delayMs]);

  const saveHistory = useCallback(async (list: RegisteredAccount[]) => {
    setHistory(list);
    await invoke("regbot:history-save", list);
  }, []);

  function pushLog(msg: string, type: "ok" | "err" | "info" = "info") {
    setRunLog((p) => [...p.slice(-299), { msg, type }]);
  }

  // ── Run automatic registration via BrowserWindow
  async function runBulkBrowser() {
    if (genCount < 1) {
      pushLog("Quantidade de contas inválida.", "err");
      return;
    }

    const config: RegisterConfig = {
      count: genCount,
      password: genPassword,
      prefix: genPrefix,
      usePrefix: usePrefix,
      avoidNumbers: avoidNumbers,
      starterId: parseInt(genStarter, 10) || 7,
      gender: genGender
    };

    setIsRunning(true);
    setRunLog([]);
    setProgress({ current: 0, total: config.count });
    pushLog(`Iniciando navegador para registrar ${config.count} conta(s)...`, "info");

    // Subscribe to progress events from main process
    const unsubProgress = on("regbot:progress", (info: unknown) => {
      const prog = info as BrowserProgress;
      setProgress({ current: prog.current, total: prog.total });
      const prefix = `[${prog.current}/${prog.total}] [${prog.nick}]`;
      const isErr = prog.action.startsWith("✗") || prog.action.startsWith("ERRO");
      const isOk = prog.action.startsWith("✓");
      pushLog(`${prefix} ${prog.action}`, isOk ? "ok" : isErr ? "err" : "info");

      // When a result arrives, update history
      if (prog.result) {
        const r = prog.result;
        setHistory((prev) => {
          // Check if we already have this account
          const existing = prev.find((h) => h.login === r.login);
          if (existing) {
            const updated = prev.map((h) =>
              h.login === r.login ? {
                ...h,
                status: r.success ? "ok" as const : "error" as const,
                token: r.success && r.token ? r.token : h.token,
                lastLoginAt: r.success ? Date.now() : h.lastLoginAt,
                errorMsg: r.success ? undefined : r.message,
              } : h
            );
            invoke("regbot:history-save", updated);
            return updated;
          } else {
            const newEntry: RegisteredAccount = {
              id: uid(),
              login: r.login,
              password: genPassword,
              nick: r.nick,
              trainerName: r.nick,
              token: r.token || "",
              restoreKey: (r as any).restoreKey || "",
              starterId: config.starterId,
              gender: config.gender,
              registeredAt: Date.now(),
              lastLoginAt: r.success ? Date.now() : undefined,
              status: r.success ? "ok" : "error",
              errorMsg: r.success ? undefined : r.message,
              addedToBot: false,
            };
            const updated = [...prev, newEntry];
            invoke("regbot:history-save", updated);
            return updated;
          }
        });
      }
    });

    try {
      const res = await invoke<{ success: boolean; results: any[]; message?: string }>(
        "regbot:run-browser",
        { config, delayMs }
      );
      if (res?.success) {
        const ok = res.results?.filter((r) => r.success).length ?? 0;
        pushLog(`✓ Concluído! ${ok}/${config.count} conta(s) registrada(s) com sucesso.`, "ok");
      } else {
        pushLog(`✗ Erro: ${res?.message || "Falha desconhecida"}`, "err");
      }
    } catch (e: any) {
      pushLog(`✗ Exceção: ${e.message}`, "err");
    } finally {
      unsubProgress();
      setIsRunning(false);
    }
  }

  // ── Refresh all tokens via BrowserWindow
  async function refreshAllBrowser() {
    const valid = history.filter((h) => h.login && h.password);
    if (valid.length === 0) {
      pushLog("Nenhuma conta com credenciais para renovar.", "err");
      return;
    }

    setIsRunning(true);
    setRunLog([]);
    setProgress({ current: 0, total: valid.length });
    pushLog(`Iniciando navegador para renovar ${valid.length} token(s)...`, "info");

    // Mark all as refreshing
    const refreshingHistory = history.map((h) =>
      valid.some((v) => v.id === h.id) ? { ...h, status: "refreshing" as const } : h
    );
    setHistory(refreshingHistory);

    const unsubProgress = on("regbot:progress", (info: unknown) => {
      const prog = info as BrowserProgress;
      setProgress({ current: prog.current, total: prog.total });
      const prefix = `[${prog.current}/${prog.total}] [${prog.nick}]`;
      const isErr = prog.action.startsWith("✗") || prog.action.startsWith("ERRO");
      const isOk = prog.action.startsWith("✓");
      pushLog(`${prefix} ${prog.action}`, isOk ? "ok" : isErr ? "err" : "info");

      if (prog.result) {
        const r = prog.result;
        setHistory((prev) => {
          const updated = prev.map((h) =>
            h.login === r.login ? {
              ...h,
              status: r.success ? "ok" as const : "error" as const,
              token: r.success && r.token ? r.token : h.token,
              lastLoginAt: r.success ? Date.now() : h.lastLoginAt,
              errorMsg: r.success ? undefined : r.message,
            } : h
          );
          invoke("regbot:history-save", updated);
          return updated;
        });
      }
    });

    try {
      const accounts = valid.map((h) => ({
        login: h.login, password: h.password,
        nick: h.nick, trainerName: h.trainerName,
      }));
      const res = await invoke<{ success: boolean; results: any[]; message?: string }>(
        "regbot:login-browser",
        { accounts, delayMs }
      );
      if (res?.success) {
        const ok = res.results?.filter((r: any) => r.success).length ?? 0;
        pushLog(`✓ Tokens renovados! ${ok}/${valid.length} com sucesso.`, "ok");
      } else {
        pushLog(`✗ Erro: ${res?.message || "Falha"}`, "err");
      }
    } catch (e: any) {
      pushLog(`✗ Exceção: ${e.message}`, "err");
    } finally {
      unsubProgress();
      setIsRunning(false);
    }
  }

  // ── Refresh single token (via Browser for Turnstile)
  async function refreshTokenApi(id: string) {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    
    // Do not set isRunning(true) so we can run multiple
    setRunLog((prev) => [...prev, { msg: `Iniciando navegador para renovar token de [${entry.nick}]...`, type: "info" }]);

    const updated = history.map((h) => h.id === id ? { ...h, status: "refreshing" as const } : h);
    setHistory(updated);

    const unsubProgress = on("regbot:progress", (info: unknown) => {
      const prog = info as BrowserProgress;
      if (prog.nick !== entry.nick) return; // Ignore events from other concurrent refreshes
      
      const prefix = `[1/1] [${prog.nick}]`;
      const isErr = prog.action.startsWith("✗") || prog.action.startsWith("ERRO");
      const isOk = prog.action.startsWith("✓");
      setRunLog((prev) => [...prev, { msg: `${prefix} ${prog.action}`, type: isOk ? "ok" : isErr ? "err" : "info" }]);

      if (prog.result) {
        const r = prog.result;
        setHistory((prev) => {
          const next = prev.map((h) =>
            h.id === entry.id ? {
              ...h,
              status: r.success ? "ok" as const : "error" as const,
              token: r.success && r.token ? r.token : h.token,
              lastLoginAt: r.success ? Date.now() : h.lastLoginAt,
              errorMsg: r.success ? undefined : r.message,
            } : h
          );
          invoke("regbot:history-save", next);
          return next;
        });
      }
    });

    try {
      const accounts = [{
        login: entry.login, password: entry.password,
        nick: entry.nick, trainerName: entry.trainerName,
      }];
      const res = await invoke<{ success: boolean; results: any[]; message?: string }>(
        "regbot:login-browser",
        { accounts, delayMs: 1000 }
      );
      if (res?.success) {
        pushLog(`✓ Processo concluído para [${entry.nick}].`, "ok");
      } else {
        pushLog(`✗ Erro: ${res?.message || "Falha"}`, "err");
      }
    } catch (e: any) {
      pushLog(`✗ Exceção: ${e.message}`, "err");
    } finally {
      unsubProgress();
    }
  }

  // ── Add to bot
  async function addToBot(id: string) {
    const entry = history.find((h) => h.id === id);
    if (!entry || !entry.token) return;
    const existing = await invoke<any[]>("accounts:list") || [];
    const alreadyExists = existing.some((a) => a.name === entry.nick);
    if (alreadyExists) {
      const updated = existing.map((a) => a.name === entry.nick ? { ...a, token: entry.token } : a);
      await invoke("accounts:save", updated);
      pushLog(`[${entry.nick}] Token atualizado no bot!`, "ok");
    } else {
      const acc = createDefaultAccount(entry.nick, entry.token, "");
      (acc as any).email = entry.login;
      (acc as any).password = entry.password;
      await invoke("accounts:save", [...existing, acc]);
      pushLog(`[${entry.nick}] Adicionada ao bot!`, "ok");
    }
    const next = history.map((h) => h.id === id ? { ...h, addedToBot: true } : h);
    await saveHistory(next);
    onAccountsChanged?.();
  }

  // ── Add all ok to bot
  async function addAllToBot() {
    const okEntries = history.filter((h) => h.status === "ok" && h.token);
    const existing = await invoke<any[]>("accounts:list") || [];
    const existingNames = new Set(existing.map((a) => a.name));
    let added = 0;
    const toAdd = [...existing];
    for (const entry of okEntries) {
      if (existingNames.has(entry.nick)) {
        const idx = toAdd.findIndex((a) => a.name === entry.nick);
        if (idx >= 0) toAdd[idx] = { ...toAdd[idx], token: entry.token };
      } else {
        const acc = createDefaultAccount(entry.nick, entry.token, "");
        (acc as any).email = entry.login;
        (acc as any).password = entry.password;
        toAdd.push(acc);
        existingNames.add(entry.nick);
        added++;
      }
    }
    await invoke("accounts:save", toAdd);
    const next = history.map((h) => h.status === "ok" && h.token ? { ...h, addedToBot: true } : h);
    await saveHistory(next);
    onAccountsChanged?.();
    pushLog(`✓ ${added} conta(s) adicionadas, ${okEntries.length - added} token(s) atualizado(s)!`, "ok");
  }

  // ── Import from accounts.json
  async function importFromAccountsJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const content = ev.target?.result as string;
          const existing = JSON.parse(content);
          if (!Array.isArray(existing)) throw new Error("O arquivo JSON não contém uma lista válida.");
          
          setHistory((prev) => {
            let added = 0;
            const next = [...prev];
            for (const acc of existing) {
              if (!acc.email || !acc.password) continue;
              const exists = next.find((h) => h.nick === acc.name);
              if (!exists) {
                next.push({
                  id: uid(),
                  login: acc.email,
                  password: acc.password,
                  nick: acc.name,
                  trainerName: acc.name,
                  token: acc.token || "",
                  registeredAt: Date.now(),
                  status: acc.token ? "ok" : "pending",
                  addedToBot: true,
                  restoreKey: "",
                });
                added++;
              }
            }
            if (added > 0) {
              invoke("regbot:history-save", next);
              pushLog(`✓ ${added} conta(s) importada(s) do arquivo!`, "ok");
              return next;
            } else {
              pushLog(`Nenhuma conta nova com email/senha para importar.`, "info");
              return prev;
            }
          });
        } catch (err: any) {
          pushLog(`✗ Erro ao importar: ${err.message}`, "err");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ── Delete entry
  async function deleteEntry(id: string) {
    const next = history.filter((h) => h.id !== id);
    await saveHistory(next);
  }

  // ── Export CSV
  function exportCsv() {
    const rows = [["nick", "login", "senha", "treinador", "token", "registrado", "ultimo_login", "status"].join(";")];
    for (const h of history) {
      rows.push([h.nick, h.login, h.password, h.trainerName, h.token, fmtDate(h.registeredAt), fmtDate(h.lastLoginAt), h.status].join(";"));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Sorted & filtered history
  const displayed = history
    .filter((h) => {
      if (filterStatus !== "all" && h.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return h.nick.toLowerCase().includes(q) || h.login.toLowerCase().includes(q) || h.trainerName.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let v = 0;
      if (sortKey === "registeredAt") v = (a.registeredAt || 0) - (b.registeredAt || 0);
      else if (sortKey === "lastLoginAt") v = (a.lastLoginAt || 0) - (b.lastLoginAt || 0);
      else if (sortKey === "nick") v = a.nick.localeCompare(b.nick);
      else if (sortKey === "status") v = a.status.localeCompare(b.status);
      return sortAsc ? v : -v;
    });

  const okCount = history.filter((h) => h.status === "ok").length;
  const errCount = history.filter((h) => h.status === "error").length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown size={10} className="opacity-30" />;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }

  // ────────────────────────────────────────
  // Render
  // ────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[rgb(var(--bg-deep))]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[rgb(var(--border))] shrink-0">
        <Globe size={15} className="text-[rgb(var(--accent))]" />
        <h2 className="text-[14px] font-semibold text-[rgb(var(--text-primary))]">Registro Automático via Navegador</h2>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">{okCount} ok</span>
          <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400">{errCount} erro</span>
          <span className="px-2 py-0.5 rounded-full bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-muted))]">{history.length} total</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-[290px] shrink-0 flex flex-col border-r border-[rgb(var(--border))] overflow-y-auto p-4 space-y-3">

          {/* Info banner */}
          <div className="bg-[rgb(var(--accent))]/10 border border-[rgb(var(--accent))]/20 rounded-md px-3 py-2 text-[11px] text-[rgb(var(--accent))] leading-relaxed">
            <Globe size={11} className="inline mr-1 -mt-0.5" />
            Um navegador real será aberto e os campos serão preenchidos automaticamente.
          </div>

          {/* Generator Fields */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Contas por Ciclo (Browser)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGenCount(Math.max(1, genCount - 1))}
                className="w-8 h-8 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--accent))]/10 flex items-center justify-center font-bold"
              >-</button>
              <input
                type="number"
                min={1} max={100}
                value={genCount}
                onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                className="flex-1 px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))] text-center"
              />
              <button
                onClick={() => setGenCount(genCount + 1)}
                className="w-8 h-8 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--accent))]/10 flex items-center justify-center font-bold"
              >+</button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Senha Padrão</label>
            <div className="relative">
              <input
                type={showGenPassword ? "text" : "password"}
                value={genPassword}
                onChange={(e) => setGenPassword(e.target.value)}
                className="w-full pl-2 pr-8 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
                placeholder="Senha Padrão"
              />
              <button
                type="button"
                onClick={() => setShowGenPassword(!showGenPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-primary))]"
              >
                {showGenPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] font-semibold">Prefixo Nick</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={avoidNumbers}
                    onChange={(e) => setAvoidNumbers(e.target.checked)}
                    className="accent-[rgb(var(--accent))] w-3 h-3"
                  />
                  <span className="text-[10px] text-[rgb(var(--text-secondary))] whitespace-nowrap">Evitar Números</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePrefix}
                    onChange={(e) => setUsePrefix(e.target.checked)}
                    className="accent-[rgb(var(--accent))] w-3 h-3"
                  />
                  <span className="text-[10px] text-[rgb(var(--text-secondary))]">Ativo</span>
                </label>
              </div>
            </div>
            <input
              type="text"
              value={genPrefix}
              onChange={(e) => setGenPrefix(e.target.value)}
              disabled={!usePrefix}
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))] disabled:opacity-50"
              placeholder="Ex: Player"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Pokémon Inicial</label>
            <select
              value={genStarter}
              onChange={(e) => setGenStarter(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
            >
              <option value="0">Aleatório</option>
              <option value="1">Bulbasaur (1)</option>
              <option value="4">Charmander (4)</option>
              <option value="7">Squirtle (7)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Gênero</label>
            <select
              value={genGender}
              onChange={(e) => setGenGender(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
            >
              <option value="random">Aleatório</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Atraso entre contas (ms)</label>
            <input
              type="number"
              value={delayMs}
              onChange={(e) => setDelayMs(Math.max(1000, Number(e.target.value)))}
              min={1000} max={15000} step={500}
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={runBulkBrowser}
              disabled={isRunning || genCount < 1}
              className="w-full py-2 rounded-md text-[12px] font-semibold bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <Globe size={13} />
              {isRunning ? `Registrando... (${progress.current}/${progress.total})` : "Registrar via Navegador"}
            </button>
            <button
              onClick={refreshAllBrowser}
              disabled={isRunning || history.length === 0}
              className="w-full py-2 rounded-md text-[12px] font-medium bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={13} />
              Renovar Tokens via Navegador
            </button>
            <button
              onClick={addAllToBot}
              disabled={isRunning || okCount === 0}
              className="w-full py-2 rounded-md text-[12px] font-medium bg-green-600/15 text-green-400 hover:bg-green-600/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={13} />
              Adicionar Todas (OK) ao Bot
            </button>
            <button
              onClick={importFromAccountsJson}
              disabled={isRunning}
              className="w-full py-2 rounded-md text-[12px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={13} />
              Importar Contas Salvas
            </button>
            <button
              onClick={exportCsv}
              disabled={history.length === 0}
              className="w-full py-1.5 rounded-md text-[11px] font-medium bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 border border-[rgb(var(--border))]"
            >
              <Download size={12} />
              Exportar CSV
            </button>
          </div>

          {/* Progress bar */}
          {isRunning && progress.total > 0 && (
            <div className="w-full bg-[rgb(var(--bg-surface))] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-[rgb(var(--accent))] transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Log */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Log de Operações</label>
            <div className="h-44 overflow-y-auto bg-[rgb(var(--bg-deep))] rounded-md border border-[rgb(var(--border))] p-2 space-y-0.5 font-mono text-[10px]">
              {runLog.length === 0 && <div className="text-[rgb(var(--text-faint))]">Aguardando...</div>}
              {runLog.map((l, i) => (
                <div key={i} className={l.type === "ok" ? "text-green-400" : l.type === "err" ? "text-red-400" : "text-[rgb(var(--text-secondary))]"}>
                  {l.msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Right panel: history table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgb(var(--border))] shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--text-faint))]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-7 pr-3 py-1 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))] w-44"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter size={11} className="text-[rgb(var(--text-faint))]" />
              {(["all", "ok", "error", "pending"] as FilterStatus[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${filterStatus === f ? "bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]" : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"}`}
                >
                  {f === "all" ? "Todos" : f === "ok" ? "OK" : f === "error" ? "Erros" : "Pendentes"}
                </button>
              ))}
            </div>
            <div className="ml-auto text-[11px] text-[rgb(var(--text-faint))]">{displayed.length} exibidos</div>
          </div>

          {/* Table header */}
          <div
            className="grid text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))] px-4 py-2 border-b border-[rgb(var(--border))] shrink-0"
            style={{ gridTemplateColumns: "24px 1fr 1fr 1fr 80px 110px 110px 130px" }}
          >
            <div />
            <button className="text-left flex items-center gap-1" onClick={() => toggleSort("nick")}>Nick <SortIcon k="nick" /></button>
            <div>Login</div>
            <div>Treinador</div>
            <button className="text-left flex items-center gap-1" onClick={() => toggleSort("status")}>Status <SortIcon k="status" /></button>
            <button className="text-left flex items-center gap-1" onClick={() => toggleSort("registeredAt")}>Registrado <SortIcon k="registeredAt" /></button>
            <button className="text-left flex items-center gap-1" onClick={() => toggleSort("lastLoginAt")}>Último Login <SortIcon k="lastLoginAt" /></button>
            <div>Ações</div>
          </div>

          {/* Table rows */}
          <div className="flex-1 overflow-y-auto">
            {displayed.length === 0 && (
              <div className="flex items-center justify-center h-32 text-[12px] text-[rgb(var(--text-faint))]">
                Nenhuma conta registrada ainda.
              </div>
            )}
            {displayed.map((entry) => (
              <div key={entry.id}>
                <div
                  className="grid items-center px-4 py-2 border-b border-[rgb(var(--border))]/40 hover:bg-[rgb(var(--bg-surface))]/40 transition-colors cursor-pointer text-[12px]"
                  style={{ gridTemplateColumns: "24px 1fr 1fr 1fr 80px 110px 110px 130px" }}
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  {/* Status icon */}
                  <div>
                    {entry.status === "ok" && <CheckCircle2 size={13} className="text-green-400" />}
                    {entry.status === "error" && <XCircle size={13} className="text-red-400" />}
                    {entry.status === "pending" && <Clock size={13} className="text-yellow-400" />}
                    {entry.status === "refreshing" && <RefreshCw size={13} className="text-blue-400 animate-spin" />}
                  </div>
                  <div className="truncate font-medium text-[rgb(var(--text-primary))]">{entry.nick}</div>
                  <div className="truncate text-[rgb(var(--text-secondary))]">{entry.login}</div>
                  <div className="truncate text-[rgb(var(--text-secondary))]">{entry.trainerName || "—"}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      entry.status === "ok" ? "bg-green-600/20 text-green-400" :
                      entry.status === "error" ? "bg-red-600/20 text-red-400" :
                      entry.status === "refreshing" ? "bg-blue-600/20 text-blue-400" :
                      "bg-yellow-600/20 text-yellow-400"
                    }`}>
                      {entry.status === "refreshing" ? "..." : entry.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[rgb(var(--text-faint))]">{fmtDate(entry.registeredAt)}</div>
                  <div className="text-[11px] text-[rgb(var(--text-faint))]">{fmtDate(entry.lastLoginAt)}</div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => refreshTokenApi(entry.id)}
                      disabled={entry.status === "refreshing"}
                      title="Renovar Token (API rápida)"
                      className="p-1.5 rounded hover:bg-blue-600/20 text-blue-400 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw size={12} />
                    </button>
                    {entry.status === "ok" && (
                      <button
                        onClick={() => addToBot(entry.id)}
                        title="Adicionar/Atualizar no Bot"
                        className={`p-1.5 rounded transition-colors ${entry.addedToBot ? "text-green-400 hover:bg-green-600/20" : "text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/20"}`}
                      >
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(entry)}
                      title="Editar"
                      className="p-1.5 rounded hover:bg-yellow-600/20 text-yellow-400 transition-colors"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      title="Remover"
                      className="p-1.5 rounded hover:bg-red-600/20 text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Expanded row */}
                {expandedId === entry.id && (
                  <div className="px-8 py-3 bg-[rgb(var(--bg-surface))]/30 border-b border-[rgb(var(--border))]/40 space-y-2 text-[12px]">
                    {entry.errorMsg && (
                      <div className="text-red-400 bg-red-600/10 px-3 py-1.5 rounded text-[11px]">⚠ {entry.errorMsg}</div>
                    )}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <div>
                        <div className="text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Senha</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[rgb(var(--text-secondary))]">
                            {showPasswords[entry.id] ? entry.password : "••••••••"}
                          </span>
                          <button onClick={() => setShowPasswords((p) => ({ ...p, [entry.id]: !p[entry.id] }))} className="text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-primary))]">
                            {showPasswords[entry.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[rgb(var(--text-muted))] mb-0.5">JWT Token</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[rgb(var(--text-secondary))] break-all">
                            {showTokens[entry.id] ? (entry.token || "—") : maskToken(entry.token)}
                          </span>
                          {entry.token && (
                            <>
                              <button onClick={() => setShowTokens((p) => ({ ...p, [entry.id]: !p[entry.id] }))} className="text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-primary))] shrink-0">
                                {showTokens[entry.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                              <button onClick={() => navigator.clipboard.writeText(entry.token)} title="Copiar token" className="shrink-0 text-[rgb(var(--text-faint))] hover:text-[rgb(var(--accent))]">
                                <Key size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Restore Key and additional details */}
                      <div className="col-span-2 grid grid-cols-3 gap-x-4 pt-2 border-t border-[rgb(var(--border))]/20">
                        <div>
                          <div className="text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Dropmail Restore Key</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[rgb(var(--text-secondary))] break-all">
                              {showRestoreKeys[entry.id] ? (entry.restoreKey || "—") : (entry.restoreKey ? "••••••••" : "—")}
                            </span>
                            {entry.restoreKey && (
                              <button onClick={() => setShowRestoreKeys((p) => ({ ...p, [entry.id]: !p[entry.id] }))} className="text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-primary))] shrink-0">
                                {showRestoreKeys[entry.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Pokémon Inicial</div>
                          <div className="text-[11px] text-[rgb(var(--text-secondary))]">
                            {entry.starterId === 1 ? "Bulbasaur" : entry.starterId === 4 ? "Charmander" : entry.starterId === 7 ? "Squirtle" : (entry.starterId || "—")}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Gênero</div>
                          <div className="text-[11px] text-[rgb(var(--text-secondary))] capitalize">
                            {entry.gender || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgb(var(--bg-card))] border border-[rgb(var(--border))] rounded-lg w-[320px] shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--bg-surface))] border-b border-[rgb(var(--border))]">
              <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">Editar Conta</h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-[rgb(var(--text-muted))] hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] mb-1">
                  E-mail (Login)
                </label>
                <input
                  type="text"
                  value={editLogin}
                  onChange={(e) => setEditLogin(e.target.value)}
                  className="w-full bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] rounded px-3 py-1.5 text-[12px] text-[rgb(var(--text-primary))] focus:border-[rgb(var(--accent))] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] mb-1">
                  Nick
                </label>
                <input
                  type="text"
                  value={editNick}
                  onChange={(e) => setEditNick(e.target.value)}
                  className="w-full bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] rounded px-3 py-1.5 text-[12px] text-[rgb(var(--text-primary))] focus:border-[rgb(var(--accent))] focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="px-4 py-3 bg-[rgb(var(--bg-surface))]/50 border-t border-[rgb(var(--border))] flex justify-end gap-2">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-3 py-1.5 rounded text-[11px] font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-base))] hover:text-[rgb(var(--text-primary))] transition-colors border border-transparent hover:border-[rgb(var(--border))]"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-1.5 rounded text-[11px] font-medium bg-[rgb(var(--accent))] text-white hover:brightness-110 transition-all shadow-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

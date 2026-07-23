import { useState, useEffect, useCallback } from "react";
import { invoke } from "../../lib/ipc";
import { createDefaultAccount } from "../../types";
import {
  UserPlus, RefreshCw, Trash2, Eye, EyeOff, CheckCircle2,
  XCircle, Clock, Download, ChevronDown, ChevronUp, Key, Search, Filter
} from "lucide-react";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
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
}

interface RegisterJob {
  login: string;
  password: string;
  nick: string;
  trainerName: string;
}

type SortKey = "registeredAt" | "nick" | "status" | "lastLoginAt";
type FilterStatus = "all" | "ok" | "error" | "pending";

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtDate(ts?: number) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function maskToken(t: string) {
  if (!t) return "—";
  return t.slice(0, 12) + "..." + t.slice(-8);
}

// ──────────────────────────────────────────
// Component
// ──────────────────────────────────────────
export function RegisterBot({ onAccountsChanged }: { onAccountsChanged?: () => void }) {
  const [history, setHistory] = useState<RegisteredAccount[]>([]);

  // ── Mass register form
  const [bulkText, setBulkText] = useState("");
  const [bulkFormat, setBulkFormat] = useState<"nick:login:pass" | "login:pass:nick" | "nick:login:pass:trainer">("nick:login:pass");
  const [defaultTrainer, setDefaultTrainer] = useState("");
  const [delayMs, setDelayMs] = useState(1500);
  const [isRunning, setIsRunning] = useState(false);
  const [runLog, setRunLog] = useState<{ msg: string; type: "ok" | "err" | "info" }[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // ── UI state
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>("registeredAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    invoke<RegisteredAccount[]>("regbot:history-get").then((h) => {
      if (Array.isArray(h)) setHistory(h);
    });
  }, []);

  const saveHistory = useCallback(async (list: RegisteredAccount[]) => {
    setHistory(list);
    await invoke("regbot:history-save", list);
  }, []);

  function pushLog(msg: string, type: "ok" | "err" | "info" = "info") {
    setRunLog((p) => [...p.slice(-199), { msg, type }]);
  }

  // ── Parse bulk input
  function parseJobs(): RegisterJob[] {
    return bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .map((line) => {
        const parts = line.split(":");
        if (bulkFormat === "nick:login:pass") {
          return { nick: parts[0] || "", login: parts[1] || "", password: parts[2] || "", trainerName: parts[3] || defaultTrainer || parts[0] || "" };
        } else if (bulkFormat === "login:pass:nick") {
          return { login: parts[0] || "", password: parts[1] || "", nick: parts[2] || "", trainerName: defaultTrainer || parts[2] || "" };
        } else {
          // nick:login:pass:trainer
          return { nick: parts[0] || "", login: parts[1] || "", password: parts[2] || "", trainerName: parts[3] || defaultTrainer || parts[0] || "" };
        }
      })
      .filter((j) => j.login && j.password && j.nick);
  }

  // ── Register a single account
  async function registerOne(job: RegisterJob): Promise<RegisteredAccount> {
    const entry: RegisteredAccount = {
      id: uid(),
      login: job.login,
      password: job.password,
      nick: job.nick,
      trainerName: job.trainerName,
      token: "",
      registeredAt: Date.now(),
      status: "pending",
      addedToBot: false,
    };
    try {
      const res = await invoke<{ success: boolean; token?: string; message?: string }>("regbot:register", {
        login: job.login,
        password: job.password,
        nick: job.nick,
        trainerName: job.trainerName,
      });
      if (res?.success && res.token) {
        entry.token = res.token;
        entry.status = "ok";
        entry.lastLoginAt = Date.now();
      } else {
        entry.status = "error";
        entry.errorMsg = res?.message || "Erro desconhecido";
      }
    } catch (e: any) {
      entry.status = "error";
      entry.errorMsg = e.message || "Erro de rede";
    }
    return entry;
  }

  // ── Login (refresh token) for an existing account
  async function refreshToken(id: string) {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    const updated = history.map((h) => h.id === id ? { ...h, status: "refreshing" as const } : h);
    setHistory(updated);
    await invoke("regbot:history-save", updated);

    try {
      const res = await invoke<{ success: boolean; token?: string; message?: string }>("regbot:login", {
        login: entry.login,
        password: entry.password,
      });
      const newEntry: RegisteredAccount = {
        ...entry,
        status: res?.success && res.token ? "ok" : "error",
        token: res?.success && res.token ? res.token : entry.token,
        lastLoginAt: res?.success ? Date.now() : entry.lastLoginAt,
        errorMsg: res?.success ? undefined : (res?.message || "Falha no login"),
      };
      const next = history.map((h) => h.id === id ? newEntry : h);
      await saveHistory(next);
      pushLog(`[${entry.nick}] ${res?.success ? "Token renovado!" : "Falha: " + res?.message}`, res?.success ? "ok" : "err");
    } catch (e: any) {
      const next = history.map((h) => h.id === id ? { ...h, status: "error" as const, errorMsg: e.message } : h);
      await saveHistory(next);
      pushLog(`[${entry.nick}] Erro: ${e.message}`, "err");
    }
  }

  // ── Refresh ALL tokens sequentially
  async function refreshAll() {
    const valid = history.filter((h) => h.login && h.password);
    setIsRunning(true);
    setRunLog([]);
    setProgress({ current: 0, total: valid.length });

    for (let i = 0; i < valid.length; i++) {
      const entry = valid[i];
      setProgress({ current: i + 1, total: valid.length });
      pushLog(`[${i + 1}/${valid.length}] Renovando token: ${entry.nick} (${entry.login})...`);

      // Mark as refreshing
      setHistory((prev) => prev.map((h) => h.id === entry.id ? { ...h, status: "refreshing" as const } : h));

      try {
        const res = await invoke<{ success: boolean; token?: string; message?: string }>("regbot:login", {
          login: entry.login,
          password: entry.password,
        });
        setHistory((prev) => prev.map((h) => h.id === entry.id ? {
          ...h,
          status: res?.success && res.token ? "ok" : "error",
          token: res?.success && res.token ? res.token : h.token,
          lastLoginAt: res?.success ? Date.now() : h.lastLoginAt,
          errorMsg: res?.success ? undefined : (res?.message || "Falha"),
        } : h));
        pushLog(`  → ${entry.nick}: ${res?.success ? "OK" : "ERRO - " + res?.message}`, res?.success ? "ok" : "err");
      } catch (e: any) {
        setHistory((prev) => prev.map((h) => h.id === entry.id ? { ...h, status: "error" as const, errorMsg: e.message } : h));
        pushLog(`  → ${entry.nick}: Exceção - ${e.message}`, "err");
      }

      if (i < valid.length - 1) await new Promise((r) => setTimeout(r, delayMs));
    }

    // Save final state
    setHistory((prev) => {
      invoke("regbot:history-save", prev);
      return prev;
    });
    setIsRunning(false);
    pushLog("✓ Refresh de tokens concluído!", "ok");
  }

  // ── Run bulk registration
  async function runBulk() {
    const jobs = parseJobs();
    if (jobs.length === 0) {
      pushLog("Nenhuma conta válida para registrar.", "err");
      return;
    }
    setIsRunning(true);
    setRunLog([]);
    setProgress({ current: 0, total: jobs.length });

    const newEntries: RegisteredAccount[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      setProgress({ current: i + 1, total: jobs.length });
      pushLog(`[${i + 1}/${jobs.length}] Registrando: ${job.nick} (${job.login})...`);
      const entry = await registerOne(job);
      newEntries.push(entry);
      pushLog(`  → ${entry.status === "ok" ? "OK ✓ Token obtido" : "ERRO: " + entry.errorMsg}`, entry.status === "ok" ? "ok" : "err");
      const next = [...history, ...newEntries.slice(newEntries.indexOf(entry))];
      setHistory([...history, ...newEntries]);
      if (i < jobs.length - 1) await new Promise((r) => setTimeout(r, delayMs));
    }

    const finalHistory = [...history, ...newEntries];
    await saveHistory(finalHistory);
    setIsRunning(false);
    pushLog(`✓ Concluído: ${newEntries.filter((e) => e.status === "ok").length}/${jobs.length} registradas com sucesso!`, "ok");
  }

  // ── Add account to bot
  async function addToBot(id: string) {
    const entry = history.find((h) => h.id === id);
    if (!entry || !entry.token) return;
    const existing = await invoke<any[]>("accounts:list") || [];
    const alreadyExists = existing.some((a) => a.name === entry.nick);
    if (alreadyExists) {
      // update token only
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

  // ── Delete entry
  async function deleteEntry(id: string) {
    const next = history.filter((h) => h.id !== id);
    await saveHistory(next);
  }

  // ── Export history CSV
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
      {/* ── Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[rgb(var(--border))] shrink-0">
        <UserPlus size={15} className="text-[rgb(var(--accent))]" />
        <h2 className="text-[14px] font-semibold text-[rgb(var(--text-primary))]">Registro Automático de Contas</h2>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">{okCount} ok</span>
          <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400">{errCount} erro</span>
          <span className="px-2 py-0.5 rounded-full bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-muted))]">{history.length} total</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Form + Log */}
        <div className="w-[300px] shrink-0 flex flex-col border-r border-[rgb(var(--border))] overflow-y-auto p-4 space-y-4">

          {/* Format */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Formato das linhas</label>
            <select
              value={bulkFormat}
              onChange={(e) => setBulkFormat(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
            >
              <option value="nick:login:pass">nick:login:senha</option>
              <option value="login:pass:nick">login:senha:nick</option>
              <option value="nick:login:pass:trainer">nick:login:senha:treinador</option>
            </select>
          </div>

          {/* Default trainer */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Nome do Treinador Padrão</label>
            <input
              value={defaultTrainer}
              onChange={(e) => setDefaultTrainer(e.target.value)}
              placeholder="(usa o nick se vazio)"
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>

          {/* Delay */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Delay entre registros (ms)</label>
            <input
              type="number"
              value={delayMs}
              onChange={(e) => setDelayMs(Math.max(500, Number(e.target.value)))}
              min={500}
              max={10000}
              step={500}
              className="w-full px-2 py-1.5 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>

          {/* Bulk textarea */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">
              Contas ({parseJobs().length} válidas)
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"# Um por linha\nnick:login@email.com:senha123\nnick2:login2@email.com:senha456"}
              rows={8}
              className="w-full px-2 py-2 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[11px] text-[rgb(var(--text-primary))] font-mono focus:outline-none focus:border-[rgb(var(--accent))] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={runBulk}
              disabled={isRunning || parseJobs().length === 0}
              className="w-full py-2 rounded-md text-[12px] font-semibold bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={13} />
              {isRunning ? `Registrando... (${progress.current}/${progress.total})` : "Registrar Contas"}
            </button>
            <button
              onClick={refreshAll}
              disabled={isRunning || history.length === 0}
              className="w-full py-2 rounded-md text-[12px] font-medium bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={13} />
              Renovar Todos os Tokens
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
                className="h-full bg-[rgb(var(--accent))] transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Log */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1 font-semibold">Log de Operações</label>
            <div className="h-40 overflow-y-auto bg-[rgb(var(--bg-deep))] rounded-md border border-[rgb(var(--border))] p-2 space-y-0.5 font-mono text-[10px]">
              {runLog.length === 0 && <div className="text-[rgb(var(--text-faint))]">Aguardando...</div>}
              {runLog.map((l, i) => (
                <div key={i} className={l.type === "ok" ? "text-green-400" : l.type === "err" ? "text-red-400" : "text-[rgb(var(--text-secondary))]"}>
                  {l.msg}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: History table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgb(var(--border))] shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--text-faint))]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-7 pr-3 py-1 rounded-md bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-primary))] focus:outline-none focus:border-[rgb(var(--accent))] w-48"
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
          <div className="grid text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))] px-4 py-2 border-b border-[rgb(var(--border))] shrink-0"
            style={{ gridTemplateColumns: "24px 1fr 1fr 1fr 80px 120px 120px 140px" }}>
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
                  style={{ gridTemplateColumns: "24px 1fr 1fr 1fr 80px 120px 120px 140px" }}
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  {/* Status icon */}
                  <div>
                    {entry.status === "ok" && <CheckCircle2 size={13} className="text-green-400" />}
                    {entry.status === "error" && <XCircle size={13} className="text-red-400" />}
                    {entry.status === "pending" && <Clock size={13} className="text-yellow-400" />}
                    {entry.status === "refreshing" && <RefreshCw size={13} className="text-blue-400 animate-spin" />}
                  </div>

                  {/* Nick */}
                  <div className="truncate font-medium text-[rgb(var(--text-primary))]">{entry.nick}</div>

                  {/* Login */}
                  <div className="truncate text-[rgb(var(--text-secondary))]">{entry.login}</div>

                  {/* Trainer */}
                  <div className="truncate text-[rgb(var(--text-secondary))]">{entry.trainerName || "—"}</div>

                  {/* Status */}
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${entry.status === "ok" ? "bg-green-600/20 text-green-400" : entry.status === "error" ? "bg-red-600/20 text-red-400" : entry.status === "refreshing" ? "bg-blue-600/20 text-blue-400" : "bg-yellow-600/20 text-yellow-400"}`}>
                      {entry.status === "refreshing" ? "..." : entry.status}
                    </span>
                  </div>

                  {/* Registered */}
                  <div className="text-[11px] text-[rgb(var(--text-faint))]">{fmtDate(entry.registeredAt)}</div>

                  {/* Last login */}
                  <div className="text-[11px] text-[rgb(var(--text-faint))]">{fmtDate(entry.lastLoginAt)}</div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => refreshToken(entry.id)}
                      disabled={isRunning || entry.status === "refreshing"}
                      title="Renovar Token (Relogar)"
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
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
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
                            <button onClick={() => setShowTokens((p) => ({ ...p, [entry.id]: !p[entry.id] }))} className="text-[rgb(var(--text-faint))] hover:text-[rgb(var(--text-primary))] shrink-0">
                              {showTokens[entry.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                          )}
                          {entry.token && (
                            <button
                              onClick={() => navigator.clipboard.writeText(entry.token)}
                              title="Copiar token"
                              className="shrink-0 text-[rgb(var(--text-faint))] hover:text-[rgb(var(--accent))]"
                            >
                              <Key size={11} />
                            </button>
                          )}
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
    </div>
  );
}

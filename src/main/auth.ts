import crypto from "node:crypto";
import os from "node:os";
import { execSync } from "node:child_process";

const KA_URL = "https://keyauth.win/api/1.2/";
const KA_NAME = "POKEIDLEAPI";
const KA_OWNERID = "2ttaPgZOdq";

function getHWID(): string {
  try {
    const username = os.userInfo().username;
    const result = execSync(
      `wmic useraccount where name="${username}" get sid`,
      { encoding: "utf-8", timeout: 5000, windowsHide: true }
    );
    const lines = result.split(/\r?\n/).filter((l) => l.trim() && !l.toLowerCase().includes("sid"));
    if (lines.length > 0 && lines[0].trim()) return lines[0].trim();
  } catch {}
  try {
    const result = execSync("wmic csproduct get uuid", {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    const lines = result.split(/\r?\n/).filter((l) => l.trim() && !l.toLowerCase().includes("uuid"));
    if (lines.length > 0 && lines[0].trim()) return lines[0].trim();
  } catch {}
  return String(os.hostname() + os.userInfo().username);
}

function hashpw(pw: string): string {
  if (pw.length === 64 && /^[0-9a-fA-F]+$/.test(pw)) return pw;
  return crypto.createHash("sha256").update(pw).digest("hex");
}

let sessionId = "";

interface KaResponse {
  success: boolean;
  message: string;
  sessionid?: string;
  download?: string;
}

async function kaInit(): Promise<{ ok: boolean; msg: string; sid: string }> {
  try {
    const body = new URLSearchParams({
      type: "init",
      ver: "4.3.3",
      name: KA_NAME,
      ownerid: KA_OWNERID,
    });
    const res = await fetch(KA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const d: KaResponse = await res.json();
    if (d.message === "invalidver") {
      return { ok: false, msg: `UPDATE_REQUIRED|${d.download || ""}`, sid: "" };
    }
    sessionId = d.sessionid || "";
    return { ok: d.success, msg: d.message || "Erro", sid: sessionId };
  } catch (e: any) {
    return { ok: false, msg: e.message || "Erro de rede", sid: "" };
  }
}

export async function kaLogin(username: string, password: string): Promise<{ success: boolean; message: string }> {
  const init = await kaInit();
  if (init.msg.startsWith("UPDATE_REQUIRED|")) return { success: false, message: init.msg };
  if (!init.sid) return { success: false, message: `Init falhou: ${init.msg}` };

  try {
    const body = new URLSearchParams({
      type: "login",
      username,
      pass: hashpw(password),
      hwid: getHWID(),
      sessionid: init.sid,
      name: KA_NAME,
      ownerid: KA_OWNERID,
    });
    const res = await fetch(KA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const d: KaResponse = await res.json();
    return { success: d.success, message: d.message || "Erro" };
  } catch (e: any) {
    return { success: false, message: e.message || "Erro de rede" };
  }
}

export async function kaRegister(
  username: string,
  password: string,
  licenseKey: string
): Promise<{ success: boolean; message: string }> {
  const init = await kaInit();
  if (init.msg.startsWith("UPDATE_REQUIRED|")) return { success: false, message: init.msg };
  if (!init.sid) return { success: false, message: `Init falhou: ${init.msg}` };

  try {
    const body = new URLSearchParams({
      type: "register",
      username,
      pass: hashpw(password),
      key: licenseKey,
      hwid: getHWID(),
      sessionid: init.sid,
      name: KA_NAME,
      ownerid: KA_OWNERID,
    });
    const res = await fetch(KA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const d: KaResponse = await res.json();
    return { success: d.success, message: d.message || "Erro" };
  } catch (e: any) {
    return { success: false, message: e.message || "Erro de rede" };
  }
}

export async function kaUpgrade(
  username: string,
  password: string,
  newKey: string
): Promise<{ success: boolean; message: string }> {
  const init = await kaInit();
  if (init.msg.startsWith("UPDATE_REQUIRED|")) return { success: false, message: init.msg };
  if (!init.sid) return { success: false, message: `Init falhou: ${init.msg}` };

  try {
    const body = new URLSearchParams({
      type: "upgrade",
      username,
      pass: hashpw(password),
      key: newKey,
      hwid: getHWID(),
      sessionid: init.sid,
      name: KA_NAME,
      ownerid: KA_OWNERID,
    });
    const res = await fetch(KA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const d: KaResponse = await res.json();
    return { success: d.success, message: d.message || "Erro" };
  } catch (e: any) {
    return { success: false, message: e.message || "Erro de rede" };
  }
}

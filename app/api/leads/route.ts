import crypto from "crypto";

// ─── CONFIGURACIÓN DE NEXT.JS (CRUCIAL PARA EVITAR CACHE) ───────────────────
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Lead = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  area: string;
  industry: string;
  status: string;
  notes: string;
  lastAction: string;
};

type SavedStatus = {
  status: string;
  notes: string;
  lastAction: string;
};

// ─── GOOGLE AUTH ──────────────────────────────────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!;

  let privateKey = rawKey
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("GOOGLE_PRIVATE_KEY mal formateada.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error("No se pudo obtener el token de Google: " + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// ─── LEER CRM_Status ─────────────────────────────────────────────────────────
async function readStatusSheet(token: string, sheetId: string): Promise<Record<string, SavedStatus>> {
  const range = encodeURIComponent("CRM_Status!A2:E1000");
  // Añadimos un timestamp a la URL para forzar a la API de Google a darnos datos frescos
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?t=${Date.now()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return {};

  const data = await res.json();
  const rows: string[][] = data.values || [];
  const result: Record<string, SavedStatus> = {};
  for (const row of rows) {
    const [id, , status, notes, lastAction] = row;
    if (id) {
      result[id] = {
        status: status || "new",
        notes: notes || "",
        lastAction: lastAction || "",
      };
    }
  }
  return result;
}

// ─── ASEGURAR pestaña CRM_Status ─────────────────────────────────────────────
async function ensureStatusSheet(token: string, sheetId: string): Promise<void> {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const meta = await metaRes.json();
  const sheets = meta.sheets || [];
  const exists = sheets.some((s: any) => s.properties.title === "CRM_Status");

  if (!exists) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: "CRM_Status" } } }],
      }),
    });
    await writeRange(token, sheetId, "CRM_Status!A1:E1", [["id", "name", "status", "notes", "lastAction"]]);
  }
}

// ─── ESCRIBIR RANGO ──────────────────────────────────────────────────────────
async function writeRange(token: string, sheetId: string, range: string, values: string[][]): Promise<void> {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
}

// ─── GUARDAR / ACTUALIZAR ────────────────────────────────────────────────────
async function upsertStatusRow(token: string, sheetId: string, id: string, name: string, status: string, notes: string, lastAction: string): Promise<void> {
  await ensureStatusSheet(token, sheetId);

  const range = encodeURIComponent("CRM_Status!A2:A1000");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const data = await res.json();
  const rows: string[][] = data.values || [];

  const rowIndex = rows.findIndex((r) => r[0] === id);
  const newRow = [id, name, status, notes, lastAction];

  if (rowIndex >= 0) {
    const targetRange = `CRM_Status!A${rowIndex + 2}:E${rowIndex + 2}`;
    await writeRange(token, sheetId, targetRange, [newRow]);
  } else {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("CRM_Status!A:E")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [newRow] }),
      }
    );
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isEmail(v: string) { return v.includes("@"); }
function isPhone(v: string) { return /(\(?\d{3}\)?|\d{1}-\d{3}).*\d{4}/.test(v); }
function cleanPhone(v: string) { return v.replace(/\s+/g, " ").replace(/\.$/, "").trim(); }
function normalizeStatus(v: string) {
  const low = v.toLowerCase().trim();
  if (["new", "sin contactar"].includes(low)) return "new";
  if (["very_early", "muy temprano"].includes(low)) return "very_early";
  if (["interest", "interes", "interés"].includes(low)) return "interest";
  if (["followup", "seguimiento"].includes(low)) return "followup";
  if (["no_call", "no llamar"].includes(low)) return "no_call";
  return "";
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const SHEET_GID = process.env.GOOGLE_SHEET_GID;

  if (!SHEET_ID || !SHEET_GID) return Response.json({ error: "Missing Env Vars" }, { status: 500 });

  // 1. Leer leads (gviz) - Forzamos no-cache aquí también
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}&t=${Date.now()}`;
  const gvizRes = await fetch(gvizUrl, { cache: "no-store" });
  const text = await gvizRes.text();

  const jsonText = text.replace("/*O_o*/", "").replace("google.visualization.Query.setResponse(", "").slice(0, -2);
  const gvizData = JSON.parse(jsonText);

  // 2. Leer CRM_Status
  let savedStatuses: Record<string, SavedStatus> = {};
  try {
    const token = await getGoogleAccessToken();
    savedStatuses = await readStatusSheet(token, SHEET_ID);
  } catch (e) { console.error("Error CRM_Status:", e); }

  // 3. Parsear
  const rows = gvizData.table.rows.map((row: any, index: number) => {
    const cells = row.c.map((cell: any) => (cell?.v || "").toString().trim()).filter(Boolean);
    if (!cells.length) return null;

    const id = String(index + 1);
    const saved = savedStatuses[id];

    // Lógica simplificada de detección de campos para brevedad
    const phoneMatch = cells.join(" ").match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\d{1}-\d{3}-\d{3}-\d{4})/);
    const name = cells[0] || `Lead ${id}`;

    return {
      id,
      name,
      contact: cells[1] || "",
      phone: phoneMatch ? cleanPhone(phoneMatch[0]) : "",
      email: cells.find(isEmail) || "",
      area: cells[2] || "",
      status: saved?.status || "new",
      notes: saved?.notes || "",
      lastAction: saved?.lastAction || "",
    };
  }).filter(Boolean);

  return Response.json(rows);
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SHEET_ID) return Response.json({ error: "Missing ID" }, { status: 500 });

  try {
    const body = await request.json();
    const { id, name, status, notes, lastAction } = body;
    const token = await getGoogleAccessToken();
    await upsertStatusRow(token, SHEET_ID, id, name, status, notes, lastAction);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
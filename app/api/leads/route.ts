import crypto from "crypto";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// --- AUTH DE GOOGLE ---
async function getGoogleAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!;
  const privateKey = rawKey.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n").trim();

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256").update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, "base64url");
  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    cache: "no-store",
  });

  const data = await tokenRes.json();
  return data.access_token;
}

// --- GUARDAR DATOS (UPSERT) ---
async function upsertStatusRow(token: string, sheetId: string, id: string, name: string, status: string, notes: string, lastAction: string) {
  // Forzar que Google no use cache al buscar la fila
  const rangeCheck = encodeURIComponent("CRM_Status!A2:A1000");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeCheck}?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const data = await res.json();
  const rows = data.values || [];
  const rowIndex = rows.findIndex((r: any) => r[0] === id);
  const newRow = [id, name, status, notes, lastAction];

  if (rowIndex >= 0) {
    const target = `CRM_Status!A${rowIndex + 2}:E${rowIndex + 2}`;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(target)}?valueInputOption=RAW`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [newRow] }),
    });
  } else {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("CRM_Status!A:E")}:append?valueInputOption=RAW`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [newRow] }),
    });
  }
}

export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GID = process.env.GOOGLE_SHEET_GID;
  
  // 1. Leads desde GVIZ (Public)
  const gvizRes = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}&t=${Date.now()}`, { cache: "no-store" });
  const text = await gvizRes.text();
  const json = JSON.parse(text.replace("/*O_o*/", "").replace("google.visualization.Query.setResponse(", "").slice(0, -2));

  // 2. Estados desde CRM_Status (Private)
  const token = await getGoogleAccessToken();
  const statusRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("CRM_Status!A2:E1000")}?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const statusData = await statusRes.json();
  const saved = (statusData.values || []).reduce((acc: any, row: any) => {
    acc[row[0]] = { status: row[2], notes: row[3], lastAction: row[4] };
    return acc;
  }, {});

  const rows = json.table.rows.map((r: any, i: number) => {
    const id = String(i + 1);
    const cells = r.c.map((c: any) => c?.v || "");
    const s = saved[id];
    return {
      id,
      name: cells[0] || `Lead ${id}`,
      contact: cells[1] || "",
      phone: cells[2] || "",
      email: cells[3] || "",
      area: cells[4] || "",
      status: s?.status || "new",
      notes: s?.notes || "",
      lastAction: s?.lastAction || "",
    };
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const token = await getGoogleAccessToken();
  await upsertStatusRow(token, process.env.GOOGLE_SHEET_ID!, body.id, body.name, body.status, body.notes, body.lastAction);
  return Response.json({ ok: true });
}
import crypto from "crypto";

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

// ─── GOOGLE AUTH (sin dependencias externas) ─────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!;
  // Vercel escapa los \n — los restauramos
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");

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
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(
      "No se pudo obtener el token de Google: " + JSON.stringify(tokenData)
    );
  }
  return tokenData.access_token;
}

// ─── LEER CRM_Status desde Sheets API ────────────────────────────────────────
async function readStatusSheet(
  token: string,
  sheetId: string
): Promise<Record<string, SavedStatus>> {
  const range = encodeURIComponent("CRM_Status!A2:E1000");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    // La hoja CRM_Status puede no existir todavía — devolvemos vacío
    return {};
  }

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

// ─── ASEGURAR que la pestaña CRM_Status exista ───────────────────────────────
async function ensureStatusSheet(
  token: string,
  sheetId: string
): Promise<void> {
  // Intentamos leer la metadata del spreadsheet para ver si existe
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = await metaRes.json();
  const sheets: { properties: { title: string } }[] = meta.sheets || [];
  const exists = sheets.some((s) => s.properties.title === "CRM_Status");

  if (!exists) {
    // Crear la pestaña
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: "CRM_Status" } } }],
        }),
      }
    );
    // Agregar encabezados
    await writeRange(token, sheetId, "CRM_Status!A1:E1", [
      ["id", "name", "status", "notes", "lastAction"],
    ]);
  }
}

// ─── ESCRIBIR UN RANGO ───────────────────────────────────────────────────────
async function writeRange(
  token: string,
  sheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );
}

// ─── GUARDAR O ACTUALIZAR una fila en CRM_Status ─────────────────────────────
async function upsertStatusRow(
  token: string,
  sheetId: string,
  id: string,
  name: string,
  status: string,
  notes: string,
  lastAction: string
): Promise<void> {
  await ensureStatusSheet(token, sheetId);

  // Leer todas las filas para buscar si ya existe
  const range = encodeURIComponent("CRM_Status!A2:A1000");
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  const data = await res.json();
  const rows: string[][] = data.values || [];

  const rowIndex = rows.findIndex((r) => r[0] === id);
  const newRow = [id, name, status, notes, lastAction];

  if (rowIndex >= 0) {
    // Actualizar fila existente (rowIndex + 2 porque empezamos en A2)
    const targetRange = `CRM_Status!A${rowIndex + 2}:E${rowIndex + 2}`;
    await writeRange(token, sheetId, targetRange, [newRow]);
  } else {
    // Agregar nueva fila al final
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("CRM_Status!A:E")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [newRow] }),
      }
    );
  }
}

// ─── HELPERS para parsear el Sheet de leads ──────────────────────────────────
function isEmail(value: string) {
  return value.includes("@");
}

function isPhone(value: string) {
  return /(\(?\d{3}\)?|\d{1}-\d{3}).*\d{4}/.test(value);
}

function cleanPhone(value: string) {
  return value.replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

function normalizeStatus(value: string) {
  const v = value.toLowerCase().trim();
  if (["new", "sin contactar"].includes(v)) return "new";
  if (["very_early", "muy temprano"].includes(v)) return "very_early";
  if (["interest", "interes", "interés", "interés / etapa inicial"].includes(v))
    return "interest";
  if (["followup", "seguimiento", "seguimiento / interés medio"].includes(v))
    return "followup";
  if (["no_call", "no llamar", "no llamar más"].includes(v)) return "no_call";
  return "";
}

// ─── GET — Leer todos los leads ───────────────────────────────────────────────
export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const SHEET_GID = process.env.GOOGLE_SHEET_GID;

  if (!SHEET_ID || !SHEET_GID) {
    return Response.json(
      { error: "Missing GOOGLE_SHEET_ID or GOOGLE_SHEET_GID" },
      { status: 500 }
    );
  }

  // 1. Leer leads del gviz (sin autenticación)
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;
  const gvizRes = await fetch(gvizUrl, { cache: "no-store" });
  const text = await gvizRes.text();

  if (!text.includes("google.visualization.Query.setResponse")) {
    return Response.json(
      {
        error:
          "No se pudo leer el Sheet. Verifica que esté compartido como lector.",
        preview: text.slice(0, 300),
      },
      { status: 400 }
    );
  }

  const jsonText = text
    .replace("/*O_o*/", "")
    .replace("google.visualization.Query.setResponse(", "")
    .slice(0, -2);

  const gvizData = JSON.parse(jsonText);

  // 2. Leer estados guardados de CRM_Status (con autenticación)
  let savedStatuses: Record<string, SavedStatus> = {};
  try {
    const token = await getGoogleAccessToken();
    savedStatuses = await readStatusSheet(token, SHEET_ID);
  } catch (e) {
    // Si falla la auth, continuamos solo con los datos del sheet
    console.error("Error leyendo CRM_Status:", e);
  }

  // 3. Parsear leads
  const areaWords = [
    "Hospitality",
    "Tourism",
    "Healthcare",
    "Higher Education",
    "Entertainment",
    "Manufacturing",
    "Space Coast",
    "Apartment Complex",
    "Restaurant",
    "Health Care",
    "Healthcare / Hospital",
  ];

  const rows: Lead[] = gvizData.table.rows
    .map((row: any, index: number) => {
      const cells = row.c
        .map((cell: any) => (cell?.v || "").toString().trim())
        .filter(Boolean);

      if (!cells.length) return null;

      const joinedCells = cells.join(" ");

      let name = "",
        contact = "",
        phone = "",
        email = "",
        area = "";

      const phoneMatch = joinedCells.match(
        /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\d{1}-\d{3}-\d{3}-\d{4})/i
      );
      if (phoneMatch) phone = cleanPhone(phoneMatch[0]);

      const emailCell = cells.find((c: string) => isEmail(c));
      if (emailCell) email = emailCell;

      for (const cell of cells) {
        if (
          !name &&
          !isPhone(cell) &&
          !isEmail(cell) &&
          !normalizeStatus(cell) &&
          cell.length > 5
        ) {
          name = cell;
          continue;
        }
        if (
          !contact &&
          cell !== name &&
          !isPhone(cell) &&
          !isEmail(cell) &&
          !normalizeStatus(cell) &&
          cell.length <= 45
        ) {
          contact = cell;
          continue;
        }
        if (
          !area &&
          cell !== name &&
          cell !== contact &&
          !isPhone(cell) &&
          !isEmail(cell) &&
          !normalizeStatus(cell)
        ) {
          area = cell;
          continue;
        }
      }

      const detectedArea = cells.find((c: string) =>
        areaWords.some((w) => c.toLowerCase().includes(w.toLowerCase()))
      );
      if (detectedArea) {
        area = detectedArea;
        if (contact === detectedArea) contact = "";
      }

      const statusCell = cells.find((c: string) => normalizeStatus(c));
      const sheetStatus = statusCell ? normalizeStatus(statusCell) : "new";

      if (!name) name = `Lead ${index + 1}`;

      const id = String(index + 1);
      const saved = savedStatuses[id];

      return {
        id,
        name,
        contact,
        phone,
        email,
        area,
        industry: "",
        // El estado guardado en CRM_Status tiene prioridad sobre el del sheet
        status: saved?.status || sheetStatus,
        notes: saved?.notes || "",
        lastAction: saved?.lastAction || "",
      };
    })
    .filter(Boolean);

  return Response.json(rows);
}

// ─── POST — Guardar cambios de un lead ────────────────────────────────────────
export async function POST(request: Request) {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

  if (!SHEET_ID) {
    return Response.json({ error: "Missing GOOGLE_SHEET_ID" }, { status: 500 });
  }

  let body: {
    id: string;
    name: string;
    status: string;
    notes: string;
    lastAction: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const { id, name, status, notes, lastAction } = body;

  if (!id || !status) {
    return Response.json({ error: "id y status son requeridos" }, { status: 400 });
  }

  try {
    const token = await getGoogleAccessToken();
    await upsertStatusRow(token, SHEET_ID, id, name, status, notes, lastAction);
    return Response.json({ ok: true, id });
  } catch (e) {
    console.error("Error guardando en Sheets:", e);
    return Response.json(
      { error: "No se pudo guardar en Google Sheets", detail: String(e) },
      { status: 500 }
    );
  }
}

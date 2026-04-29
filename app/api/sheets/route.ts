export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const SHEET_GID = process.env.GOOGLE_SHEET_GID;

  if (!SHEET_ID || !SHEET_GID) {
    return Response.json(
      {
        error: "Missing GOOGLE_SHEET_ID or GOOGLE_SHEET_GID",
        sheetId: SHEET_ID || null,
        sheetGid: SHEET_GID || null,
      },
      { status: 500 }
    );
  }

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;

  const res = await fetch(url, {
    cache: "no-store",
  });

  const text = await res.text();

  if (!text.includes("google.visualization.Query.setResponse")) {
    return Response.json(
      {
        error:
          "No se pudo leer el Sheet. Verifica que esté compartido como lector o publicado en la web.",
        preview: text.slice(0, 300),
      },
      { status: 400 }
    );
  }

  const jsonText = text
    .replace("/*O_o*/", "")
    .replace("google.visualization.Query.setResponse(", "")
    .slice(0, -2);

  const data = JSON.parse(jsonText);

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
    if (["interest", "interes", "interés", "interés / etapa inicial"].includes(v)) return "interest";
    if (["followup", "seguimiento", "seguimiento / interés medio"].includes(v)) return "followup";
    if (["no_call", "no llamar", "no llamar más"].includes(v)) return "no_call";

    return "";
  }

  const rows = data.table.rows
    .map((row: any, index: number) => {
      const cells = row.c
        .map((cell: any) => (cell?.v || "").toString().trim())
        .filter(Boolean);

      const joinedCells = cells.join(" ");

      let name = "";
      let contact = "";
      let phone = "";
      let email = "";
      let area = "";
      let industry = "";

      const phoneMatch = joinedCells.match(
        /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\d{1}-\d{3}-\d{3}-\d{4}|407-582-HR4U\s?\(4748\))/i
      );

      if (phoneMatch) {
        phone = cleanPhone(phoneMatch[0]);
      }

      const emailCell = cells.find((cell: string) => isEmail(cell));
      if (emailCell) {
        email = emailCell;
      }

      for (const cell of cells) {
        if (!name && !isPhone(cell) && !isEmail(cell) && !normalizeStatus(cell) && cell.length > 5) {
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

      const detectedArea = cells.find((cell: string) =>
        areaWords.some((word) => cell.toLowerCase().includes(word.toLowerCase()))
      );

      if (detectedArea) {
        area = detectedArea;

        if (contact === detectedArea) {
          contact = "";
        }
      }

      const statusCell = cells.find((cell: string) => normalizeStatus(cell));
      const status = statusCell ? normalizeStatus(statusCell) : "new";

      if (name === "Mizner Tower Condo Inc" && contact === "561") {
        contact = "";
        phone = "561-395-7355";
      }

      if (name === "Puch Manufacturing") {
        contact = "";
        area = "Manufacturing";
      }

      if (name === "Custom Aerospace") {
        contact = "Mike Huber";
        area = "Space Coast";
      }

      if (!name) {
  name = "Lead " + (index + 1);
}

      return {
        id: String(index + 1),
        name,
        contact,
        phone,
        email,
        area,
        industry,
        status,
      };
    })
    .filter(Boolean);
    

  return Response.json(rows);
}
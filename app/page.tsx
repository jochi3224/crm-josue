"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

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

const STATUS_OPTIONS = [
  { key: "new", label: "Sin contactar", color: "#64748b", bg: "#1e293b", dot: "#94a3b8" },
  { key: "very_early", label: "Muy Temprano", color: "#0ea5e9", bg: "#0c1a2e", dot: "#38bdf8" },
  { key: "interest", label: "Interés", color: "#22c55e", bg: "#052e16", dot: "#4ade80" },
  { key: "followup", label: "Seguimiento", color: "#eab308", bg: "#1c1408", dot: "#facc15" },
  { key: "no_call", label: "No llamar", color: "#ef4444", bg: "#1c0505", dot: "#f87171" },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s]));
const STORAGE_KEY = "va_crm_statuses";

function loadSavedChanges() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLeadChange(id: string, changes: Partial<Lead>) {
  const saved = loadSavedChanges();
  saved[id] = { ...saved[id], ...changes };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function mergeSheetWithLocalChanges(sheetLeads: Lead[]): Lead[] {
  const saved = loadSavedChanges();

  return sheetLeads.map((lead) => ({
    ...lead,
    status: saved[lead.id]?.status || lead.status || "new",
    notes: saved[lead.id]?.notes || lead.notes || "",
    lastAction: saved[lead.id]?.lastAction || lead.lastAction || "",
  }));
}

function buttonStyle(bg: string, color: string, border: string) {
  return {
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  };
}

function StatusBadge({ statusKey, small = false }: { statusKey: string; small?: boolean }) {
  const s = STATUS_MAP[statusKey] || STATUS_MAP.new;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}33`,
        borderRadius: 20,
        padding: small ? "2px 8px" : "4px 10px",
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: small ? 6 : 7,
          height: small ? 6 : 7,
          borderRadius: "50%",
          background: s.dot,
        }}
      />
      {s.label}
    </span>
  );
}

function StatCard({
  icon,
  value,
  label,
  accent,
  percent = false,
}: {
  icon: string;
  value: number;
  label: string;
  accent: string;
  percent?: boolean;
}) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: `1px solid ${accent}33`,
        borderRadius: 12,
        padding: "16px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 60, opacity: 0.05 }}>
        {icon}
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, color: accent }}>
        {percent ? `${value}%` : value}
      </div>

      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function LeadModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (id: string, changes: Partial<Lead>) => void;
}) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || "");
  const [lastAction, setLastAction] = useState(lead.lastAction || "");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000099",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: 28,
          width: 520,
          maxWidth: "95vw",
          boxShadow: "0 25px 60px #00000088",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{lead.area}</div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {lead.contact && (
            <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>CONTACTO</div>
              <div style={{ fontSize: 13 }}>{lead.contact}</div>
            </div>
          )}

          {lead.phone && (
            <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>TELÉFONO</div>
              <a href={`tel:${lead.phone}`} style={{ fontSize: 13, color: "#38bdf8", textDecoration: "none" }}>
                {lead.phone}
              </a>
            </div>
          )}

          {lead.email && (
            <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>EMAIL</div>
              <a href={`mailto:${lead.email}`} style={{ fontSize: 13, color: "#38bdf8", textDecoration: "none" }}>
                {lead.email}
              </a>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>ESTADO</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(s.key)}
                style={{
                  background: status === s.key ? s.bg : "#1e293b",
                  color: status === s.key ? s.color : "#64748b",
                  border: `1px solid ${status === s.key ? s.color : "#334155"}`,
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>ÚLTIMA ACCIÓN</div>
          <input
            value={lastAction}
            onChange={(e) => setLastAction(e.target.value)}
            placeholder="ej: Llamé, dejé mensaje / Envié email"
            style={{
              width: "100%",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 13,
              color: "#e2e8f0",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>NOTAS</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Agrega notas sobre este lead..."
            style={{
              width: "100%",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 13,
              color: "#e2e8f0",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} style={buttonStyle("#0c4a6e", "#38bdf8", "#0284c7")}>
              📞 Llamar
            </a>
          )}

          {lead.email && (
            <a href={`mailto:${lead.email}`} style={buttonStyle("#14532d", "#4ade80", "#16a34a")}>
              ✉️ Email
            </a>
          )}

          <button
            onClick={() => onSave(lead.id, { status, notes, lastAction })}
            style={buttonStyle("#3730a3", "#a5b4fc", "#4f46e5")}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  async function loadLeads() {
    const res = await fetch("/api/sheets", { cache: "no-store" });
    const sheetLeads = await res.json();
    setLeads(mergeSheetWithLocalChanges(sheetLeads));
  }

  useEffect(() => {
    loadLeads();

    const interval = setInterval(() => {
      loadLeads();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  function updateLead(id: string, changes: Partial<Lead>) {
    saveLeadChange(id, changes);

    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, ...changes } : lead))
    );

    setSelectedLead(null);
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterStatus !== "all" && lead.status !== filterStatus) return false;

      const q = search.toLowerCase();

      return (
        lead.name.toLowerCase().includes(q) ||
        lead.contact.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        lead.area.toLowerCase().includes(q)
      );
    });
  }, [leads, search, filterStatus]);

  const toCall = leads.filter(
    (l) => l.phone && l.status !== "no_call" && ["new", "very_early", "followup"].includes(l.status)
  );

  const toEmail = leads.filter(
    (l) => l.email && l.status !== "no_call" && ["new", "very_early"].includes(l.status)
  );

  const followUps = leads.filter((l) => l.status === "followup");
  const interested = leads.filter((l) => l.status === "interest");
  const noCall = leads.filter((l) => l.status === "no_call");
  const newLeads = leads.filter((l) => l.status === "new");

  const contacted = leads.filter((l) => l.status !== "new").length;
  const pending = newLeads.length;
  const successRate = contacted > 0 ? Math.round((interested.length / contacted) * 100) : 0;
  const interestRate = leads.length > 0 ? Math.round((interested.length / leads.length) * 100) : 0;

  const statusChartData = [
    { name: "Interés", value: interested.length, color: "#22c55e" },
    { name: "Seguimiento", value: followUps.length, color: "#facc15" },
    { name: "No llamar", value: noCall.length, color: "#ef4444" },
    { name: "Sin contactar", value: newLeads.length, color: "#94a3b8" },
  ];

  const performanceChartData = [
    { name: "Éxito", value: successRate },
    { name: "Interés", value: interestRate },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", fontFamily: "Arial, sans-serif" }}>
      <header
        style={{
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ❄️
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>VA Lead Generator</div>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>HVAC · Florida · CRM</div>
        </div>

        <nav style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {[
            ["dashboard", "📊 Dashboard"],
            ["actions", "⚡ Acciones"],
            ["all", "📋 Todos"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                background: view === key ? "#1e293b" : "transparent",
                color: view === key ? "#f1f5f9" : "#64748b",
                border: view === key ? "1px solid #334155" : "1px solid transparent",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}

          <button onClick={loadLeads} style={buttonStyle("#1e3a5f", "#38bdf8", "#3b82f6")}>
            🔄 Actualizar
          </button>
        </nav>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        {view === "dashboard" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Panel General</h1>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 4, marginBottom: 24 }}>
              Orlando, Florida · {leads.length} leads totales
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
              <StatCard icon="📞" value={toCall.length} label="Por llamar" accent="#38bdf8" />
              <StatCard icon="✉️" value={toEmail.length} label="Por emailear" accent="#4ade80" />
              <StatCard icon="🔄" value={followUps.length} label="Seguimientos" accent="#facc15" />
              <StatCard icon="🌟" value={interested.length} label="Con interés" accent="#a78bfa" />
              <StatCard icon="🚫" value={noCall.length} label="No llamar" accent="#f87171" />
              <StatCard icon="🆕" value={newLeads.length} label="Sin contactar" accent="#94a3b8" />
              <StatCard icon="📈" value={successRate} label="% Éxito" accent="#22c55e" percent />
              <StatCard icon="💎" value={interestRate} label="% Interés" accent="#a78bfa" percent />
              <StatCard icon="✅" value={contacted} label="Contactados" accent="#4ade80" />
              <StatCard icon="⏳" value={pending} label="Pendientes" accent="#facc15" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              <div style={chartCardStyle}>
                <h3 style={chartTitleStyle}>📊 Estado de Leads</h3>
                <ResponsiveContainer width="100%" height="88%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={chartCardStyle}>
                <h3 style={chartTitleStyle}>📈 Rendimiento</h3>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={performanceChartData}>
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <LeadList title="📞 LLAMAR HOY" color="#38bdf8" leads={toCall} onSelect={setSelectedLead} />
              <LeadList title="✉️ ENVIAR EMAIL" color="#4ade80" leads={toEmail} onSelect={setSelectedLead} />
              <LeadList title="🔄 SEGUIMIENTO PENDIENTE" color="#facc15" leads={followUps} onSelect={setSelectedLead} />
              <LeadList title="🌟 CON INTERÉS" color="#a78bfa" leads={interested} onSelect={setSelectedLead} />
            </div>
          </>
        )}

        {view === "actions" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>⚡ Plan de Acción</h1>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
              Prioridades del día basadas en el estado de cada lead
            </p>

            <LeadList title="🔄 Seguimiento Urgente" color="#facc15" leads={followUps} onSelect={setSelectedLead} />
            <LeadList title="🌟 Nutrir Interés" color="#a78bfa" leads={interested} onSelect={setSelectedLead} />
            <LeadList title="📞 Llamadas Nuevas" color="#38bdf8" leads={toCall} onSelect={setSelectedLead} />
          </>
        )}

        {view === "all" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>📋 Todos los Leads</h1>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Buscar nombre, contacto, email..."
                style={{
                  flex: 1,
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "#e2e8f0",
                }}
              />

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <option value="all">Todos los estados</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#1e293b" }}>
                  <tr>
                    {["Empresa", "Contacto", "Teléfono", "Email", "Área", "Estado", "Última Acción"].map((h) => (
                      <th key={h} style={{ padding: 12, fontSize: 10, color: "#64748b", textAlign: "left" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      style={{ borderBottom: "1px solid #1e293b", cursor: "pointer" }}
                    >
                      <td style={tdStyle}>{lead.name}</td>
                      <td style={tdStyle}>{lead.contact || "-"}</td>
                      <td style={{ ...tdStyle, color: "#38bdf8" }}>{lead.phone || "-"}</td>
                      <td style={{ ...tdStyle, color: "#4ade80" }}>{lead.email || "-"}</td>
                      <td style={tdStyle}>{lead.area || "-"}</td>
                      <td style={tdStyle}>
                        <StatusBadge statusKey={lead.status} small />
                      </td>
                      <td style={tdStyle}>{lead.lastAction || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {selectedLead && <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} onSave={updateLead} />}
    </div>
  );
}

function LeadList({
  title,
  color,
  leads,
  onSelect,
}: {
  title: string;
  color: string;
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}) {
  return (
    <div style={{ background: "#0f172a", border: `1px solid ${color}55`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{title}</span>
        <span style={{ marginLeft: "auto", background: "#1e293b", color, borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>
          {leads.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {leads.slice(0, 8).map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelect(lead)}
            style={{
              background: "#1e293b",
              borderRadius: 8,
              padding: "8px 10px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{lead.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {lead.phone || lead.email || lead.area}
              </div>
            </div>

            <StatusBadge statusKey={lead.status} small />
          </div>
        ))}
      </div>
    </div>
  );
}

const chartCardStyle = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 20,
  height: 310,
};

const chartTitleStyle = {
  fontSize: 14,
  margin: "0 0 14px",
  color: "#f1f5f9",
};

const tdStyle = {
  padding: 12,
  fontSize: 12,
  color: "#e2e8f0",
};
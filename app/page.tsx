"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";

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

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { key: "new",        label: "Sin contactar", color: "#64748b", bg: "#1e293b", dot: "#94a3b8" },
  { key: "very_early", label: "Muy Temprano",  color: "#0ea5e9", bg: "#0c1a2e", dot: "#38bdf8" },
  { key: "interest",   label: "Interés",       color: "#22c55e", bg: "#052e16", dot: "#4ade80" },
  { key: "followup",   label: "Seguimiento",   color: "#eab308", bg: "#1c1408", dot: "#facc15" },
  { key: "no_call",    label: "No llamar",     color: "#ef4444", bg: "#1c0505", dot: "#f87171" },
];
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s]));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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
    whiteSpace: "nowrap" as const,
  };
}

const tdStyle = { padding: 12, fontSize: 12, color: "#e2e8f0" };
const chartCardStyle = {
  background: "#0f172a", border: "1px solid #1e293b",
  borderRadius: 12, padding: 20, height: 310,
};
const chartTitleStyle = { fontSize: 14, margin: "0 0 14px", color: "#f1f5f9" };

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function StatusBadge({ statusKey, small = false }: { statusKey: string; small?: boolean }) {
  const s = STATUS_MAP[statusKey] || STATUS_MAP.new;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
      borderRadius: 20, padding: small ? "2px 8px" : "4px 10px",
      fontSize: small ? 10 : 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: small ? 6 : 7, height: small ? 6 : 7, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

function StatCard({ icon, value, label, accent, percent = false }: {
  icon: string; value: number; label: string; accent: string; percent?: boolean;
}) {
  return (
    <div style={{
      background: "#0f172a", border: `1px solid ${accent}33`,
      borderRadius: 12, padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 56, opacity: 0.05 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent }}>{percent ? `${value}%` : value}</div>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function LeadList({ title, color, leads, onSelect }: {
  title: string; color: string; leads: Lead[]; onSelect: (l: Lead) => void;
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
          <div key={lead.id} onClick={() => onSelect(lead)} style={{
            background: "#1e293b", borderRadius: 8, padding: "8px 10px",
            cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{lead.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {lead.phone || lead.email || lead.area}
              </div>
            </div>
            <StatusBadge statusKey={lead.status} small />
          </div>
        ))}
        {leads.length > 8 && (
          <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 4 }}>
            +{leads.length - 8} más
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave, saving }: {
  lead: Lead;
  onClose: () => void;
  onSave: (id: string, changes: Partial<Lead>) => void;
  saving: boolean;
}) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || "");
  const [lastAction, setLastAction] = useState(lead.lastAction || "");

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#00000099",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, backdropFilter: "blur(4px)", padding: 12,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f172a", border: "1px solid #1e293b",
          borderRadius: 16, padding: 22, width: "min(520px, 94vw)",
          maxHeight: "92vh", overflowY: "auto", boxShadow: "0 25px 60px #00000088",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{lead.area}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20 }}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
          {lead.contact && (
            <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>CONTACTO</div>
              <div style={{ fontSize: 13 }}>{lead.contact}</div>
            </div>
          )}
          {lead.phone && (
            <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>TELÉFONO</div>
              <a href={`tel:${lead.phone}`} style={{ fontSize: 13, color: "#38bdf8", textDecoration: "none" }}>{lead.phone}</a>
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
                  borderRadius: 20, padding: "5px 12px", fontSize: 11,
                  fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: status === s.key ? s.dot : "#475569" }} />
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
            placeholder="ej: Llamé, dejé mensaje"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#e2e8f0",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>NOTAS</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 8, padding: "9px 12px", fontSize: 13,
              color: "#e2e8f0", resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={() => onSave(lead.id, { status, notes, lastAction })}
            disabled={saving}
            style={{
              ...buttonStyle("#3730a3", "#a5b4fc", "#4f46e5"),
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Guardando…" : "💾 Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: type === "ok" ? "#052e16" : "#1c0505",
      border: `1px solid ${type === "ok" ? "#16a34a" : "#dc2626"}`,
      color: type === "ok" ? "#4ade80" : "#f87171",
      padding: "12px 18px", borderRadius: 10, fontSize: 13,
      fontWeight: 500, zIndex: 2000,
    }}>
      {msg}
    </div>
  );
}

// ─── MAIN CRM ─────────────────────────────────────────────────────────────────
export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isMobile, setIsMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "error" } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // CARGAR LEADS (Forzando no-cache con Timestamp)
  const loadLeads = useCallback(async () => {
    setSyncing(true);
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/leads?t=${timestamp}`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Error en servidor");
      const data = await res.json();
      setLeads(data);
      setLastSync(new Date());
    } catch (e) {
      showToast("❌ Error al cargar", "error");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
    const interval = setInterval(loadLeads, 60000);
    return () => clearInterval(interval);
  }, [loadLeads]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function showToast(msg: string, type: "ok" | "error" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function updateLead(id: string, changes: Partial<Lead>) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: lead.name,
          status: changes.status ?? lead.status,
          notes: changes.notes ?? lead.notes ?? "",
          lastAction: changes.lastAction ?? lead.lastAction ?? "",
        }),
      });

      if (!res.ok) throw new Error("Fallo al guardar");
      
      showToast("✅ Guardado correctamente");
      setSelectedLead(null);
      // Recargar datos inmediatamente para ver el cambio reflejado
      await loadLeads(); 
    } catch (e) {
      showToast("❌ Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterStatus !== "all" && lead.status !== filterStatus) return false;
      const q = search.toLowerCase();
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.contact.toLowerCase().includes(q) ||
        lead.area.toLowerCase().includes(q)
      );
    });
  }, [leads, search, filterStatus]);

  // Métricas para Dashboard
  const toCall     = leads.filter(l => ["new", "very_early", "followup"].includes(l.status));
  const interested = leads.filter(l => l.status === "interest");

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", fontFamily: "sans-serif" }}>
      {/* HEADER */}
      <header style={{
        background: "#0f172a", borderBottom: "1px solid #1e293b",
        padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20 }}>❄️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>VA Lead Generator</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>
              SYNC: {lastSync ? lastSync.toLocaleTimeString() : "---"}
            </div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView("dashboard")} style={buttonStyle("#1e293b", "#f1f5f9", "#334155")}>Dashboard</button>
          <button onClick={() => setView("all")} style={buttonStyle("#1e293b", "#f1f5f9", "#334155")}>Leads</button>
          <button 
            onClick={loadLeads} 
            disabled={syncing}
            style={buttonStyle("#1e3a5f", "#38bdf8", "#3b82f6")}
          >
            {syncing ? "..." : "🔄 Actualizar"}
          </button>
        </nav>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        {view === "dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <LeadList title="📞 LLAMAR HOY" color="#38bdf8" leads={toCall} onSelect={setSelectedLead} />
            <LeadList title="🌟 CON INTERÉS" color="#a78bfa" leads={interested} onSelect={setSelectedLead} />
          </div>
        )}

        {view === "all" && (
          <div style={{ background: "#0f172a", borderRadius: 12, border: "1px solid #1e293b", padding: 16 }}>
            <input 
              placeholder="🔍 Buscar..." 
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, background: "#020617", border: "1px solid #334155", color: "#fff", marginBottom: 20 }}
            />
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12 }}>
                  <th style={{ padding: 10 }}>NOMBRE</th>
                  <th style={{ padding: 10 }}>ESTADO</th>
                  <th style={{ padding: 10 }}>ÚLTIMA ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{ borderTop: "1px solid #1e293b", cursor: "pointer" }}>
                    <td style={{ padding: 10 }}>{lead.name}</td>
                    <td style={{ padding: 10 }}><StatusBadge statusKey={lead.status} small /></td>
                    <td style={{ padding: 10, fontSize: 11, color: "#64748b" }}>{lead.lastAction || "---"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedLead && (
        <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} onSave={updateLead} saving={saving} />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
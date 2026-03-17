import { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

// ─── Per-event-type field definitions for academics ───────────────────────────
// Only the fields relevant to each event type are rendered.
const ACADEMIC_EVENT_FIELDS = {
  CLASS_CANCELLED: [
    { key: "reason", label: "Reason", placeholder: "e.g. Faculty unwell", required: true },
  ],
  CLASS_RESCHEDULED: [
    { key: "reason",  label: "Reason",    placeholder: "e.g. Clashing exam",    required: true  },
    { key: "newTime", label: "New time",  placeholder: "e.g. 3:00 PM",          required: true  },
    { key: "newHall", label: "New hall",  placeholder: "e.g. LH-3",             required: false },
  ],
  EXAM_POSTPONED: [
    { key: "reason",  label: "Reason",        placeholder: "e.g. Paper not ready",  required: true  },
    { key: "newTime", label: "New date/time",  placeholder: "e.g. 15 Apr, 10:00 AM", required: false },
  ],
};

const ACADEMIC_EVENT_LABELS = {
  CLASS_CANCELLED:   "Class cancelled",
  CLASS_RESCHEDULED: "Class rescheduled",
  EXAM_POSTPONED:    "Exam postponed",
};

// ─── Non-academic domain config ───────────────────────────────────────────────
// types is now a map of eventType → field definitions (only relevant fields shown)
const OTHER_DOMAIN_CONFIG = {
  transport: {
    label: "Transport",
    desc:  "Bus alerts",
    endpoint: "/bus/event",
    field: "eventType",
    types: {
      BUS_DELAYED: [
        { key: "busId",  label: "Bus ID",       placeholder: "e.g. BUS_052",      required: true  },
        { key: "reason", label: "Reason",        placeholder: "e.g. Heavy traffic", required: true  },
        { key: "delay",  label: "Delay (mins)",  placeholder: "e.g. 15",           required: false },
      ],
      BUS_CANCELLED: [
        { key: "busId",  label: "Bus ID",  placeholder: "e.g. BUS_052",          required: true },
        { key: "reason", label: "Reason",  placeholder: "e.g. Vehicle breakdown", required: true },
      ],
      BUS_ARRIVED: [
        { key: "busId",  label: "Bus ID",              placeholder: "e.g. BUS_052",    required: true  },
        { key: "reason", label: "Note (optional)",      placeholder: "e.g. Arrived early", required: false },
      ],
    },
    roles: ["SUPER_ADMIN", "BUS_ADMIN"],
  },
  mess: {
    label: "Mess",
    desc:  "Process refunds",
    endpoint: "/mess/event",
    field: "eventType",
    types: {
      MESS_REFUND_PROCESSED: [
        { key: "studentId",    label: "Student ID (MongoDB _id)", placeholder: "e.g. 69b7d620...", required: true },
        { key: "refundAmount", label: "Refund amount (₹)",        placeholder: "e.g. 480",         required: true },
        { key: "month",        label: "Month",                    placeholder: "e.g. 2026-03",      required: true },
      ],
    },
    roles: ["SUPER_ADMIN", "MESS_ADMIN"],
  },
};

// ─── Shared result card ───────────────────────────────────────────────────────
function ResultCard({ result }) {
  if (!result?.event) return null;
  return (
    <div className="card mt-2" style={{ borderColor: "var(--green-bg)" }}>
      <div className="card-header">
        <span className="card-title" style={{ color: "var(--green)" }}>✓ Event queued</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ink-3)" }}>
          {result.event.id}
        </span>
      </div>
      <div className="card-body">
        <table style={{ width: "100%", fontSize: 13 }}>
          <tbody>
            {[
              ["Type",       result.event.type],
              ["Fired by",   result.event.firedBy],
              ["Recipients", result.event.recipients ?? "—"],
              ["Status",     result.status || result.event.status],
            ].map(([label, val]) => (
              <tr key={label}>
                <td style={{ color: "var(--ink-3)", padding: "4px 0", width: "35%" }}>{label}</td>
                <td style={{ padding: "4px 0" }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Academic event firer ─────────────────────────────────────────────────────
function AcademicEventFirer({ token }) {
  const toast = useToast();
  const [courses, setCourses]           = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [groupId, setGroupId]           = useState("");
  const [eventType, setEventType]       = useState("");
  const [fields, setFields]             = useState({});
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);

  useEffect(() => {
    api.get("/academics", token)
      .then(d => { setCourses(d.groups || []); setLoadingCourses(false); })
      .catch(() => setLoadingCourses(false));
  }, [token]);

  const selectEventType = (t) => { setEventType(t); setFields({}); setResult(null); };
  const selectCourse    = (id) => { setGroupId(id); setEventType(""); setFields({}); setResult(null); };

  const handleFire = async () => {
    if (!groupId)   { toast("Select a course",     "error"); return; }
    if (!eventType) { toast("Select an event type", "error"); return; }

    for (const f of ACADEMIC_EVENT_FIELDS[eventType] || []) {
      if (f.required && !fields[f.key]?.trim()) {
        toast(`${f.label} is required`, "error");
        return;
      }
    }

    setLoading(true);
    try {
      const data = await api.post("/academics/event", { eventType, groupId, ...fields }, token);
      setResult(data);
      if (data.event) toast("Event fired!", "success");
      else toast(data.message || "Error", "error");
    } catch { toast("Network error", "error"); }
    finally { setLoading(false); }
  };

  const fieldDefs      = ACADEMIC_EVENT_FIELDS[eventType] || [];
  const selectedCourse = courses.find(c => c.id === groupId);

  return (
    <div>
      {/* Step 1 — Course dropdown */}
      <div className="card section-gap">
        <div className="card-header"><span className="card-title">1 — Select course</span></div>
        <div className="card-body">
          {loadingCourses ? (
            <div className="empty-state"><span className="spinner" /></div>
          ) : courses.length === 0 ? (
            <div className="empty-state" style={{ padding: "16px 0" }}>
              No courses assigned to your account
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0, maxWidth: 420 }}>
              <label className="form-label">Course</label>
              <select
                className="form-select"
                value={groupId}
                onChange={e => selectCourse(e.target.value)}
              >
                <option value="">— choose a course —</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode}  —  {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — Event type chips */}
      {groupId && (
        <div className="card section-gap">
          <div className="card-header"><span className="card-title">2 — Event type</span></div>
          <div className="card-body">
            <div className="event-chips">
              {Object.keys(ACADEMIC_EVENT_FIELDS).map(t => (
                <button
                  key={t}
                  className={`event-chip ${eventType === t ? "selected" : ""}`}
                  onClick={() => selectEventType(t)}
                >
                  {ACADEMIC_EVENT_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Only the fields relevant to this event type */}
      {groupId && eventType && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">3 — Details</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {selectedCourse?.courseCode} · {ACADEMIC_EVENT_LABELS[eventType]}
            </span>
          </div>
          <div className="card-body">
            {fieldDefs.length > 0 && (
              <div className="grid-2" style={{ marginBottom: 16 }}>
                {fieldDefs.map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">
                      {f.label}
                      {f.required && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
                    </label>
                    <input
                      className="form-input"
                      placeholder={f.placeholder}
                      value={fields[f.key] || ""}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handleFire}
              disabled={loading}
              style={{ minWidth: 140 }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Fire event"}
            </button>
          </div>
        </div>
      )}

      <ResultCard result={result} />
    </div>
  );
}

// ─── Generic event firer (transport / mess) ───────────────────────────────────
function GenericEventFirer({ token, userRole }) {
  const toast = useToast();
  const [domain, setDomain]       = useState(null);
  const [eventType, setEventType] = useState("");
  const [fields, setFields]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);

  const availableDomains = Object.entries(OTHER_DOMAIN_CONFIG).filter(
    ([, cfg]) => cfg.roles.includes(userRole)
  );

  const selectDomain    = (d) => { setDomain(d); setEventType(""); setFields({}); setResult(null); };
  const selectEventType = (t) => { setEventType(t); setFields({}); setResult(null); };

  const handleFire = async () => {
    if (!eventType) { toast("Select an event type", "error"); return; }
    const cfg      = OTHER_DOMAIN_CONFIG[domain];
    const fieldDefs = cfg.types[eventType] || [];

    for (const f of fieldDefs) {
      if (f.required && !fields[f.key]?.trim()) {
        toast(`${f.label} is required`, "error");
        return;
      }
    }

    setLoading(true);
    try {
      const data = await api.post(cfg.endpoint, { [cfg.field]: eventType, ...fields }, token);
      setResult(data);
      if (data.event || data.message?.includes("success")) toast("Event fired!", "success");
      else toast(data.message || "Error firing event", "error");
    } catch { toast("Network error", "error"); }
    finally { setLoading(false); }
  };

  const fieldDefs = domain && eventType ? (OTHER_DOMAIN_CONFIG[domain].types[eventType] || []) : [];

  return (
    <div>
      {/* Step 1 — Domain */}
      <div className="card section-gap">
        <div className="card-header"><span className="card-title">1 — Choose domain</span></div>
        <div className="card-body">
          <div className="domain-grid">
            {availableDomains.map(([key, cfg]) => (
              <button
                key={key}
                className={`domain-btn ${domain === key ? "selected" : ""}`}
                onClick={() => selectDomain(key)}
              >
                <span className="d-name">{cfg.label}</span>
                <span className="d-desc">{cfg.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 2 — Event type */}
      {domain && (
        <div className="card section-gap">
          <div className="card-header"><span className="card-title">2 — Event type</span></div>
          <div className="card-body">
            <div className="event-chips">
              {Object.keys(OTHER_DOMAIN_CONFIG[domain].types).map(t => (
                <button
                  key={t}
                  className={`event-chip ${eventType === t ? "selected" : ""}`}
                  onClick={() => selectEventType(t)}
                >
                  {t.replace(/_/g, " ").toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Only relevant fields for the selected event type */}
      {domain && eventType && (
        <div className="card section-gap">
          <div className="card-header"><span className="card-title">3 — Details</span></div>
          <div className="card-body">
            {fieldDefs.length > 0 && (
              <div className="grid-2" style={{ marginBottom: 16 }}>
                {fieldDefs.map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">
                      {f.label}
                      {f.required && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
                    </label>
                    <input
                      className="form-input"
                      placeholder={f.placeholder}
                      value={fields[f.key] || ""}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handleFire}
              disabled={loading}
              style={{ minWidth: 140 }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Fire event"}
            </button>
          </div>
        </div>
      )}

      <ResultCard result={result} />
    </div>
  );
}

// ─── Super admin tabbed view ──────────────────────────────────────────────────
function SuperAdminEventFirer({ token }) {
  const [tab, setTab] = useState("academics");
  return (
    <div>
      <div className="flex-gap mb-2">
        {[["academics", "Academics"], ["other", "Transport & Mess"]].map(([key, label]) => (
          <button
            key={key}
            className={`event-chip ${tab === key ? "selected" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "academics"
        ? <AcademicEventFirer token={token} />
        : <GenericEventFirer token={token} userRole="SUPER_ADMIN" />}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function EventFirer({ token, userRole }) {
  if (userRole === "TEACHER")     return <AcademicEventFirer token={token} />;
  if (userRole === "SUPER_ADMIN") return <SuperAdminEventFirer token={token} />;
  return <GenericEventFirer token={token} userRole={userRole} />;
}
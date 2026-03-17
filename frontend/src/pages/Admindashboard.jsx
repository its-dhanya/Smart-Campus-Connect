import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import EventFirer from "../components/EventFirer";

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function roleBadge(role) {
  const map = { SUPER_ADMIN: "red", TEACHER: "blue", BUS_ADMIN: "amber", LAUNDRY_ADMIN: "green", MESS_ADMIN: "green", STUDENT: "gray" };
  return `badge badge-${map[role] || "gray"}`;
}

function domainBadge(domain) {
  const map = { transport: "amber", academics: "blue", laundry: "green", mess: "red" };
  return `badge badge-${map[domain] || "gray"}`;
}

// ── Notifications Tab (Admin) ─────────────────────────────────
const DOMAIN_DOT = {
  transport: "dot-transport",
  academics: "dot-academics",
  laundry:   "dot-laundry",
  mess:      "dot-mess",
};

function formatNotification(n) {
  const m = n.metadata || {};
  switch (n.type) {
    case "CLASS_CANCELLED":
      return { title: m.courseCode ? `${m.courseCode} — ${m.courseName || "class"} cancelled` : "Class cancelled", detail: m.reason || null };
    case "CLASS_RESCHEDULED":
      return { title: m.courseCode ? `${m.courseCode} — ${m.courseName || "class"} rescheduled` : "Class rescheduled",
        detail: [m.reason, m.newTime && `New time: ${m.newTime}`, m.newHall && `Hall: ${m.newHall}`].filter(Boolean).join(" · ") || null };
    case "EXAM_POSTPONED":
      return { title: m.courseCode ? `${m.courseCode} — ${m.courseName || "exam"} postponed` : "Exam postponed",
        detail: [m.reason, m.newTime && `Rescheduled to: ${m.newTime}`].filter(Boolean).join(" · ") || null };
    case "BUS_DELAYED":
      return { title: m.busId ? `${m.busId} delayed` : "Bus delayed",
        detail: [m.delay && `~${m.delay} min late`, m.reason].filter(Boolean).join(" · ") || null };
    case "BUS_CANCELLED":
      return { title: m.busId ? `${m.busId} cancelled` : "Bus cancelled", detail: m.reason || null };
    case "BUS_ARRIVED":
      return { title: m.busId ? `${m.busId} has arrived` : "Bus arrived", detail: m.reason || null };
    case "WASH_SLOT_BOOKED":
      return { title: (m.machine && m.time) ? `${m.machine} booked at ${m.time}` : "Laundry slot booked",
        detail: [m.block, m.date].filter(Boolean).join(" · ") || null };
    case "WASH_SLOT_CANCELLED":
      return { title: (m.machine && m.time) ? `${m.machine} slot cancelled (${m.time})` : "Slot cancelled", detail: m.block || null };
    case "WASH_MACHINE_STARTED":
      return { title: m.machine ? `${m.machine} wash started` : "Wash started", detail: m.block || null };
    case "WASH_MACHINE_COMPLETED":
      return { title: m.machine ? `${m.machine} wash completed` : "Wash complete", detail: m.block || null };
    case "MESS_CHECKIN":
      return { title: m.mealType ? `Checked in for ${m.mealType}` : "Mess check-in", detail: m.date || null };
    case "MESS_ABSENT":
      return { title: m.mealType ? `Absent for ${m.mealType}` : "Marked absent", detail: m.date || null };
    case "MESS_REFUND_REQUESTED":
      return { title: "Refund requested",
        detail: [m.month, m.refundAmount && `₹${m.refundAmount}`, m.mealsMissed && `${m.mealsMissed} meals missed`].filter(Boolean).join(" · ") || null };
    case "MESS_REFUND_PROCESSED":
      return { title: m.refundAmount ? `Refund of ₹${m.refundAmount} processed` : "Refund processed", detail: m.month || null };
    default:
      return { title: n.type.replace(/_/g, " ").toLowerCase(), detail: null };
  }
}

function AdminNotificationsTab({ userId, token }) {
  const toast = useToast();
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [deleting, setDeleting] = useState({});

  const load = () => {
    setLoading(true);
    api.get(`/students/${userId}/notifications`, token)
      .then(d => { setNotifs(d.notifications || []); setLoading(false); });
  };

  useEffect(() => { load(); }, [userId, token]);

  // Only show domain chips that actually exist in the returned data
  const availableDomains = ["all", ...Array.from(new Set(notifs.map(n => n.domain)))];
  const filtered = filter === "all" ? notifs : notifs.filter(n => n.domain === filter);

  const handleDelete = async (id) => {
    setDeleting(d => ({ ...d, [id]: true }));
    const data = await api.delete(`/students/${userId}/notifications/${id}`, token);
    setDeleting(d => ({ ...d, [id]: false }));
    if (data.eventId) {
      setNotifs(prev => prev.filter(n => n.id !== id));
      toast("Notification dismissed", "success");
    } else {
      toast(data.message || "Error", "error");
    }
  };

  return (
    <div>
      <div className="flex-gap mb-2" style={{ flexWrap: "wrap" }}>
        {availableDomains.map(f => (
          <button
            key={f}
            className={`event-chip ${filter === f ? "selected" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={load}>
          Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No notifications in the last 24 hours</div>
        ) : (
          <div className="notif-list">
            {filtered.map(n => (
              <div key={n.id} className="notif-item">
                <div className={`notif-dot ${DOMAIN_DOT[n.domain] || "dot-academics"}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="notif-domain">{n.domain}</div>
                  <div className="notif-type">{formatNotification(n).title}</div>
                  {formatNotification(n).detail && (
                    <div className="notif-meta">{formatNotification(n).detail}</div>
                  )}
                  {n.firedBy && (
                    <div className="notif-meta" style={{ color: "var(--ink-3)" }}>by {n.firedBy}</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{timeAgo(n.timestamp)}</span>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 11, padding: "3px 9px" }}
                    disabled={deleting[n.id]}
                    onClick={() => handleDelete(n.id)}
                    title="Dismiss notification"
                  >
                    {deleting[n.id]
                      ? <span className="spinner" style={{ width: 10, height: 10 }} />
                      : "✕ Dismiss"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function OverviewTab({ token, userRole }) {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    // Only SUPER_ADMIN has access to these endpoints
    if (userRole !== "SUPER_ADMIN") return;
    api.get("/admin/stats", token).then(d => setStats(d.stats));
    api.get("/admin/queue-status", token).then(d => setQueue(d.queue));
  }, [token, userRole]);

  // Non-super-admins see a simple redirect hint instead of blank loading cards
  if (userRole !== "SUPER_ADMIN") {
    return (
      <div style={{ maxWidth: 480 }}>
        <div className="card">
          <div className="card-body" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              Welcome, {userRole.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Use the sidebar to navigate to your dashboard.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Students</div>
          <div className="stat-value">{stats?.users?.totalStudents ?? "—"}</div>
          <div className="stat-sub">registered users</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Groups</div>
          <div className="stat-value">{stats?.groups?.total ?? "—"}</div>
          <div className="stat-sub">across all domains</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Subscriptions</div>
          <div className="stat-value">{stats?.subscriptions?.total ?? "—"}</div>
          <div className="stat-sub">active subscriptions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Events fired</div>
          <div className="stat-value">{stats?.events?.total ?? "—"}</div>
          <div className="stat-sub">all time</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Events by domain</span>
          </div>
          <div className="card-body">
            {stats?.events?.byDomain ? (
              Object.entries(stats.events.byDomain).map(([domain, count]) => (
                <div key={domain} className="flex-between" style={{ marginBottom: 12 }}>
                  <span className={domainBadge(domain)}>{domain}</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{count}</span>
                </div>
              ))
            ) : <div className="empty-state">Loading...</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Queue status</span>
          </div>
          <div className="card-body">
            {queue ? (
              [
                { label: "Waiting", val: queue.waiting, color: "var(--amber)" },
                { label: "Active", val: queue.active, color: "var(--blue)" },
                { label: "Completed", val: queue.completed, color: "var(--green)" },
                { label: "Failed", val: queue.failed, color: "var(--red)" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex-between" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color }}>{val}</span>
                </div>
              ))
            ) : <div className="empty-state">Loading...</div>}
          </div>
        </div>
      </div>

      {stats?.events?.recent?.length > 0 && (
        <div className="card mt-2">
          <div className="card-header">
            <span className="card-title">Recent events</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {stats.events.recent.map(e => (
                  <tr key={e._id}>
                    <td><span className={domainBadge(e.domain)}>{e.domain}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.type}</td>
                    <td><span className={`badge badge-${e.status === "completed" ? "green" : e.status === "failed" ? "red" : "amber"}`}>{e.status}</span></td>
                    <td className="text-muted">{timeAgo(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────
function UsersTab({ token }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", rollNo: "", role: "STUDENT", department: "", semester: "", hostelBlock: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/users", token).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(load, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = await api.post("/admin/users", form, token);
    setSaving(false);
    if (data.message?.includes("created")) { toast("User created", "success"); setShowForm(false); load(); }
    else toast(data.message || "Error", "error");
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this user?")) return;
    await api.delete(`/admin/users/${id}`, token);
    toast("User deleted");
    load();
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <span className="text-muted">{users.length} users</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? "Cancel" : "+ New user"}
        </button>
      </div>

      {showForm && (
        <div className="card mb-2">
          <div className="card-header"><span className="card-title">Create user</span></div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" required value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Roll / ID number</label>
                  <input className="form-input" required value={form.rollNo} onChange={e => setForm(f => ({...f, rollNo: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                    {["STUDENT","TEACHER","BUS_ADMIN","LAUNDRY_ADMIN","MESS_ADMIN"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-input" value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <span className="spinner" /> : "Create user"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="empty-state"><span className="spinner" /></div> : (
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Roll No</th><th>Role</th><th>Dept</th><th></th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td className="text-muted">{u.email}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{u.rollNo}</td>
                    <td><span className={roleBadge(u.role)}>{u.role.replace(/_/g," ")}</span></td>
                    <td className="text-muted">{u.department || "—"}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Groups Tab ───────────────────────────────────────────────
function GroupsTab({ token }) {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "TEACHER", ownerId: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/groups", token).then(d => { setGroups(d.groups || []); setLoading(false); });
  };
  useEffect(load, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = await api.post("/groups", form, token);
    setSaving(false);
    if (data.group) { toast("Group created", "success"); setShowForm(false); load(); }
    else toast(data.message || "Error", "error");
  };

  const typeColor = { TEACHER: "blue", BUS: "amber", LAUNDRY: "green", MESS: "red" };

  return (
    <div>
      <div className="flex-between mb-2">
        <span className="text-muted">{groups.length} groups</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? "Cancel" : "+ New group"}
        </button>
      </div>

      {showForm && (
        <div className="card mb-2">
          <div className="card-header"><span className="card-title">Create group</span></div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Group name</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner ID (e.g. BUS_052)</label>
                  <input className="form-input" required value={form.ownerId} onChange={e => setForm(f => ({...f, ownerId: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                    {["TEACHER","BUS","LAUNDRY","MESS"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <span className="spinner" /> : "Create group"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="empty-state"><span className="spinner" /></div> : (
            <table>
              <thead><tr><th>Name</th><th>Type</th><th>Owner ID</th></tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id || g._id}>
                    <td style={{ fontWeight: 500 }}>{g.name}</td>
                    <td><span className={`badge badge-${typeColor[g.type] || "gray"}`}>{g.type}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{g.ownerId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Queue Tab ────────────────────────────────────────────────
function QueueTab({ token }) {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/queue-status", token).then(d => { setQueue(d.queue); setLoading(false); });
  };
  useEffect(load, [token]);

  const stats = queue ? [
    { label: "Waiting", val: queue.waiting, color: "var(--amber)" },
    { label: "Active", val: queue.active, color: "var(--blue)" },
    { label: "Completed", val: queue.completed, color: "var(--green)" },
    { label: "Failed", val: queue.failed, color: "var(--red)" },
    { label: "Delayed", val: queue.delayed, color: "var(--text-2)" },
  ] : [];

  return (
    <div>
      <div className="flex-between mb-2">
        <span className="text-muted">BullMQ — campus-events</span>
        <button className="btn btn-sm" onClick={load} disabled={loading}>
          {loading ? <span className="spinner" style={{width:14,height:14}} /> : "Refresh"}
        </button>
      </div>

      <div className="stat-grid">
        {stats.map(({ label, val, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{val ?? "—"}</div>
          </div>
        ))}
      </div>

      {queue?.failed > 0 && (
        <div className="card" style={{ borderColor: "#f5c0c5" }}>
          <div className="card-body" style={{ color: "var(--red)", fontSize: 13 }}>
            {queue.failed} job(s) failed. Use <code>/admin/resend-notifications/:eventId</code> to retry.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Laundry Admin Tab — read-only monitor ─────────────────────
function LaundryAdminTab({ token }) {
  const today    = new Date().toISOString().split("T")[0];
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })();
  const [date, setDate]         = useState(tomorrow);
  const [block, setBlock]       = useState("HOSTEL-A");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading]   = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/laundry/dashboard/${block}?date=${date}`, token)
      .then(d => { setDashboard(d); setLoading(false); });
  };

  useEffect(() => { load(); }, [date, block, token]);

  const statusColor = {
    available: "var(--green)",
    booked:    "var(--amber)",
    "in-use":  "var(--blue)",
    completed: "var(--ink-3)",
    cancelled: "var(--red)",
  };
  const stats = dashboard?.stats;

  return (
    <div>
      <div className="flex-gap mb-2" style={{ flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          {date === tomorrow && (
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>Tomorrow — bookings open</div>
          )}
          {date === today && (
            <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 3 }}>Today — slots auto-transition</div>
          )}
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Block</label>
          <select className="form-select" value={block} onChange={e => setBlock(e.target.value)}>
            {["HOSTEL-A","HOSTEL-B","HOSTEL-C"].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button className="btn btn-sm" style={{ alignSelf: "flex-end" }} onClick={load}>Refresh</button>
      </div>

      {/* Info banner explaining automatic behaviour */}
      <div style={{
        fontSize: 12, color: "var(--ink-2)", background: "var(--bg-2)",
        borderRadius: 8, padding: "8px 12px", marginBottom: 14,
        border: "1px solid var(--border)",
      }}>
        Slots transition automatically: <strong>booked → in-use</strong> at slot start time,
        then <strong>in-use → available</strong> after 1 hour.
      </div>

      {stats && (
        <div className="stat-grid mb-2">
          {[
            ["Available", stats.available, "var(--green)"],
            ["Booked",    stats.booked,    "var(--amber)"],
            ["In-use",    stats.inUse,     "var(--blue)"],
            ["Completed", stats.completed, "var(--ink-3)"],
          ].map(([label, val, color]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{val ?? "—"}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="empty-state"><span className="spinner" /></div> : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Machine Status — {block} — {date}</span>
          </div>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>Machine</th><th>Time</th><th>Status</th><th>Student</th><th>Booked at</th></tr>
              </thead>
              <tbody>
                {dashboard?.machines && Object.entries(dashboard.machines).flatMap(([machine, times]) =>
                  Object.entries(times)
                    .filter(([, slot]) => slot.status !== "available")
                    .map(([time, slot]) => (
                      <tr key={`${machine}-${time}`}>
                        <td style={{ fontFamily: "monospace" }}>{machine}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{time}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: "50%",
                              background: statusColor[slot.status],
                              display: "inline-block",
                            }} />
                            {slot.status}
                          </span>
                        </td>
                        <td>{slot.studentName || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--ink-3)" }}>
                          {slot.bookedAt ? new Date(slot.bookedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    ))
                )}
                {dashboard?.machines && Object.values(dashboard.machines).every(times =>
                  Object.values(times).every(s => s.status === "available")
                ) && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>No bookings for this date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mess Admin Tab ─────────────────────────────────────────────
function MessAdminTab({ token }) {
  const today = new Date().toISOString().split("T")[0];
  const nowMonth = today.slice(0, 7);
  const [view, setView] = useState("daily");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(nowMonth);
  const [daily, setDaily] = useState(null);
  const [report, setReport] = useState(null);

  const loadDaily = () => {
    api.get(`/mess/admin/daily-checkins?date=${date}`, token).then(d => setDaily(d));
  };

  const loadReport = () => {
    api.get(`/mess/admin/monthly-report?month=${month}`, token).then(d => setReport(d));
  };

  useEffect(() => { if (view === "daily") loadDaily(); else loadReport(); }, [view, date, month, token]);

  return (
    <div>
      <div className="flex-gap mb-2">
        <button className={`event-chip ${view === "daily" ? "selected" : ""}`} onClick={() => setView("daily")}>Daily Check-ins</button>
        <button className={`event-chip ${view === "report" ? "selected" : ""}`} onClick={() => setView("report")}>Monthly Refund Report</button>
      </div>

      {view === "daily" && (
        <div>
          <div className="flex-gap mb-2" style={{ alignItems: "flex-end" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button className="btn btn-sm" onClick={loadDaily}>Load</button>
          </div>
          {daily?.checkins && (
            <div className="stat-grid">
              {[["Breakfast", daily.checkins.breakfast], ["Lunch", daily.checkins.lunch],
                ["Dinner", daily.checkins.dinner], ["Total", daily.checkins.total]].map(([label, val]) => (
                <div key={label} className="stat-card">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{val ?? "—"}</div>
                  <div className="stat-sub">check-ins</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "report" && (
        <div>
          <div className="flex-gap mb-2" style={{ alignItems: "flex-end" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Month</label>
              <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
            <button className="btn btn-sm" onClick={loadReport}>Load</button>
          </div>
          {report?.summary && (
            <>
              <div className="stat-grid mb-2">
                {[["Students", report.summary.totalStudents], ["Total Refund Due", `₹${report.summary.totalRefundDue}`],
                  ["Avg per Student", `₹${report.summary.averageRefundPerStudent}`]].map(([label, val]) => (
                  <div key={label} className="stat-card">
                    <div className="stat-label">{label}</div>
                    <div className="stat-value" style={{ fontSize: typeof val === "string" && val.includes("₹") ? 18 : undefined }}>{val ?? "—"}</div>
                  </div>
                ))}
              </div>
              {Object.keys(report.refundsByStudent || {}).length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Refund Breakdown</span></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Student ID</th><th>Meals Missed</th><th>Refund</th></tr></thead>
                      <tbody>
                        {Object.entries(report.refundsByStudent).map(([sid, info]) => (
                          <tr key={sid}>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{sid}</td>
                            <td>{info.missed}</td>
                            <td style={{ fontWeight: 500 }}>₹{info.refund}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Admin Dashboard ─────────────────────────────────────
export default function AdminDashboard({ currentPage }) {
  const { token, user } = useAuth();
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const renderPage = () => {
    switch (currentPage) {
      case "notifications": return <AdminNotificationsTab userId={user.id} token={token} />;
      case "overview": return <OverviewTab token={token} userRole={user.role} />;
      case "users": return isSuperAdmin ? <UsersTab token={token} /> : <div className="empty-state">Access denied</div>;
      case "groups": return isSuperAdmin ? <GroupsTab token={token} /> : <div className="empty-state">Access denied</div>;
      case "events": return ["LAUNDRY_ADMIN"].includes(user.role)
        ? <div className="empty-state">Event firing is not available for this role.</div>
        : <EventFirer token={token} userRole={user.role} />;
      case "queue": return isSuperAdmin ? <QueueTab token={token} /> : <div className="empty-state">Access denied</div>;
      case "laundry-admin": return <LaundryAdminTab token={token} />;
      case "mess-admin": return <MessAdminTab token={token} />;
      default: return <OverviewTab token={token} />;
    }
  };

  return <div>{renderPage()}</div>;
}
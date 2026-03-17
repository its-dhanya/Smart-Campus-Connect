import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function expiresIn(expiresAt) {
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `expires in ${h}h ${m}m`;
  return `expires in ${m}m`;
}

const DOMAIN_DOT = {
  transport: "dot-transport",
  academics: "dot-academics",
  laundry:   "dot-laundry",
  mess:      "dot-mess",
};

/**
 * Returns { title, detail } for a notification.
 * title  — short headline, specific to the event type + key metadata
 * detail — one supporting line with extra context (may be null)
 */
function formatNotification(n) {
  const m = n.metadata || {};
  switch (n.type) {
    // ── Academics ──────────────────────────────────────────
    case "CLASS_CANCELLED":
      return {
        title:  m.courseCode ? `${m.courseCode} — ${m.courseName || "class"} cancelled` : "Class cancelled",
        detail: m.reason || null,
      };
    case "CLASS_RESCHEDULED":
      return {
        title:  m.courseCode ? `${m.courseCode} — ${m.courseName || "class"} rescheduled` : "Class rescheduled",
        detail: [m.reason, m.newTime && `New time: ${m.newTime}`, m.newHall && `Hall: ${m.newHall}`]
                  .filter(Boolean).join(" · ") || null,
      };
    case "EXAM_POSTPONED":
      return {
        title:  m.courseCode ? `${m.courseCode} — ${m.courseName || "exam"} postponed` : "Exam postponed",
        detail: [m.reason, m.newTime && `Rescheduled to: ${m.newTime}`].filter(Boolean).join(" · ") || null,
      };

    // ── Transport ──────────────────────────────────────────
    case "BUS_DELAYED":
      return {
        title:  m.busId ? `${m.busId} delayed` : "Bus delayed",
        detail: [m.delay && `~${m.delay} min late`, m.reason].filter(Boolean).join(" · ") || null,
      };
    case "BUS_CANCELLED":
      return {
        title:  m.busId ? `${m.busId} cancelled` : "Bus cancelled",
        detail: m.reason || null,
      };
    case "BUS_ARRIVED":
      return {
        title:  m.busId ? `${m.busId} has arrived` : "Bus arrived",
        detail: m.reason || null,
      };

    // ── Laundry ────────────────────────────────────────────
    case "WASH_SLOT_BOOKED":
      return {
        title:  (m.machine && m.time) ? `${m.machine} booked at ${m.time}` : "Laundry slot booked",
        detail: [m.block, m.date].filter(Boolean).join(" · ") || null,
      };
    case "WASH_SLOT_CANCELLED":
      return {
        title:  (m.machine && m.time) ? `${m.machine} slot cancelled (${m.time})` : "Laundry slot cancelled",
        detail: m.block || null,
      };
    case "WASH_MACHINE_STARTED":
      return {
        title:  m.machine ? `${m.machine} wash started` : "Wash started",
        detail: m.block || null,
      };
    case "WASH_MACHINE_COMPLETED":
      return {
        title:  m.machine ? `${m.machine} wash completed` : "Wash complete",
        detail: m.block || null,
      };

    // ── Mess ───────────────────────────────────────────────
    case "MESS_CHECKIN":
      return {
        title:  m.mealType ? `Checked in for ${m.mealType}` : "Mess check-in",
        detail: m.date || null,
      };
    case "MESS_ABSENT":
      return {
        title:  m.mealType ? `Absent for ${m.mealType}` : "Marked absent",
        detail: m.date || null,
      };
    case "MESS_REFUND_REQUESTED":
      return {
        title:  "Refund requested",
        detail: [m.month, m.refundAmount && `₹${m.refundAmount}`, m.mealsMissed && `${m.mealsMissed} meals missed`]
                  .filter(Boolean).join(" · ") || null,
      };
    case "MESS_REFUND_PROCESSED":
      return {
        title:  m.refundAmount ? `Refund of ₹${m.refundAmount} processed` : "Refund processed",
        detail: m.month || null,
      };

    default:
      return { title: n.type.replace(/_/g, " ").toLowerCase(), detail: null };
  }
}

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab({ studentId, token }) {
  const toast = useToast();
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [deleting, setDeleting] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/students/${studentId}/notifications`, token)
      .then(d => { setNotifs(d.notifications || []); setLoading(false); });
  }, [studentId, token]);

  useEffect(() => { load(); }, [load]);

  // Client-side sweep: remove locally-expired notifications every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifs(prev => prev.filter(n => new Date(n.expiresAt) > Date.now()));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id) => {
    setDeleting(d => ({ ...d, [id]: true }));
    const data = await api.delete(`/students/${studentId}/notifications/${id}`, token);
    setDeleting(d => ({ ...d, [id]: false }));
    if (data.eventId) {
      setNotifs(prev => prev.filter(n => n.id !== id));
      toast("Notification dismissed", "success");
    } else {
      toast(data.message || "Error", "error");
    }
  };

  const filtered = filter === "all" ? notifs : notifs.filter(n => n.domain === filter);

  return (
    <div>
      <div className="flex-gap mb-2" style={{ flexWrap: "wrap" }}>
        {["all", "academics", "transport", "laundry", "mess"].map(f => (
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
          <div className="empty-state">No notifications</div>
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
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>
                    {expiresIn(n.expiresAt)}
                  </div>
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

// ── Laundry Tab ────────────────────────────────────────────────
const SLOTS    = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00",
                  "14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
const MACHINES = ["M1","M2","M3","M4","M5"];

function LaundryTab({ token }) {
  const toast = useToast();

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  const [block, setBlock]       = useState("HOSTEL-A");
  const [slotData, setSlotData] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [bookings, setBookings] = useState([]);
  const [view, setView]         = useState("book");
  const [booking, setBooking]   = useState({ machine: "M1", time: "09:00" });
  const [saving, setSaving]     = useState(false);

  const loadSlots = useCallback(() => {
    setLoading(true);
    api.get(`/laundry/slots/available?block=${block}&date=${tomorrow}`, token)
      .then(d => { setSlotData(d.slots || {}); setLoading(false); });
  }, [block, tomorrow, token]);

  const loadBookings = useCallback(() => {
    api.get("/laundry/my-bookings", token).then(d => setBookings(d.bookings || []));
  }, [token]);

  useEffect(() => { loadSlots(); loadBookings(); }, [loadSlots, loadBookings]);

  const handleBook = async (e) => {
    e.preventDefault();
    setSaving(true);
    // No date sent — server always books for tomorrow
    const data = await api.post("/laundry/slots/book", { block, ...booking }, token);
    setSaving(false);
    if (data.booking) {
      toast(`Slot booked for ${data.booking.date} at ${data.booking.time}`, "success");
      loadSlots();
      loadBookings();
    } else {
      toast(data.message || "Error", "error");
    }
  };

  const handleCancel = async (b) => {
    if (!confirm("Cancel this booking?")) return;
    const data = await api.delete(
      `/laundry/slots/cancel?block=${b.block}&date=${b.date}&machine=${b.machine}&time=${b.time}`,
      token
    );
    if (data.cancelled) {
      toast("Booking cancelled", "success");
      loadBookings();
      loadSlots();
    } else {
      toast(data.message || "Error", "error");
    }
  };

  const statusColor = {
    available: "var(--green)",
    booked:    "var(--amber)",
    "in-use":  "var(--blue)",
    completed: "var(--ink-3)",
    cancelled: "var(--red)",
  };

  return (
    <div>
      <div className="flex-gap mb-2">
        <button className={`event-chip ${view === "book" ? "selected" : ""}`} onClick={() => setView("book")}>
          Book a Slot
        </button>
        <button className={`event-chip ${view === "my" ? "selected" : ""}`} onClick={() => setView("my")}>
          My Bookings
        </button>
      </div>

      {view === "book" && (
        <div className="grid-2">
          {/* Availability grid — always tomorrow */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tomorrow's Availability — {tomorrow}</span>
              <select
                className="form-select"
                style={{ width: "auto", marginLeft: "auto" }}
                value={block}
                onChange={e => setBlock(e.target.value)}
              >
                {["HOSTEL-A","HOSTEL-B","HOSTEL-C"].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="card-body">
              <div style={{
                fontSize: 12, color: "var(--amber)", background: "var(--amber-bg)",
                borderRadius: 6, padding: "6px 10px", marginBottom: 12,
              }}>
                Slots can only be booked one day in advance. Unstarted bookings are
                auto-released 1 hour after the slot start time.
              </div>

              {loading ? (
                <div className="empty-state"><span className="spinner" /></div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        {MACHINES.map(m => <th key={m}>{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {SLOTS.map(time => (
                        <tr key={time}>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{time}</td>
                          {MACHINES.map(m => {
                            const s      = slotData?.[m]?.[time];
                            const status = s?.status || "available";
                            return (
                              <td key={m} style={{ textAlign: "center" }}>
                                <span
                                  style={{
                                    display: "inline-block", width: 10, height: 10,
                                    borderRadius: "50%",
                                    background: statusColor[status] || "var(--green)",
                                  }}
                                  title={`${status}${s?.studentName ? " – " + s.studentName : ""}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{
                    fontSize: 12, color: "var(--ink-3)", marginTop: 8,
                    display: "flex", gap: 12, flexWrap: "wrap",
                  }}>
                    {Object.entries(statusColor).map(([s, c]) => (
                      <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: c, display: "inline-block",
                        }} />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Booking form */}
          <div className="card">
            <div className="card-header"><span className="card-title">Book for Tomorrow</span></div>
            <div className="card-body">
              <form onSubmit={handleBook}>
                <div className="form-group">
                  <label className="form-label">Block</label>
                  <select className="form-select" value={block} onChange={e => setBlock(e.target.value)}>
                    {["HOSTEL-A","HOSTEL-B","HOSTEL-C"].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Machine</label>
                  <select
                    className="form-select"
                    value={booking.machine}
                    onChange={e => setBooking(b => ({ ...b, machine: e.target.value }))}
                  >
                    {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot</label>
                  <select
                    className="form-select"
                    value={booking.time}
                    onChange={e => setBooking(b => ({ ...b, time: e.target.value }))}
                  >
                    {SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{
                  fontSize: 13, color: "var(--ink-2)", marginBottom: 14,
                  padding: "10px 12px", background: "var(--bg-2)", borderRadius: 8,
                }}>
                  Booking <strong>{booking.machine}</strong> at <strong>{booking.time}</strong>{" "}
                  on <strong>{tomorrow}</strong> in <strong>{block}</strong>
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <span className="spinner" /> : "Confirm Booking"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {view === "my" && (
        <div className="card">
          <div className="card-header"><span className="card-title">My Bookings</span></div>
          {bookings.length === 0 ? (
            <div className="empty-state">No bookings yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Block</th><th>Machine</th><th>Time</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{b.date}</td>
                      <td>{b.block}</td>
                      <td style={{ fontFamily: "monospace" }}>{b.machine}</td>
                      <td style={{ fontFamily: "monospace" }}>{b.time}</td>
                      <td>
                        <span className={`badge badge-${
                          b.status === "booked"    ? "amber" :
                          b.status === "completed" ? "green" :
                          b.status === "in-use"    ? "blue"  : "gray"
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        {b.status === "booked" && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b)}>
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mess Tab ──────────────────────────────────────────────────
const MEALS         = ["breakfast", "lunch", "dinner"];
const COST_PER_MEAL = 80;

function MessTab({ token }) {
  const toast = useToast();
  const today    = new Date().toISOString().split("T")[0];
  const nowMonth = today.slice(0, 7);

  const [view, setView]             = useState("today");
  const [dailyMeals, setDailyMeals] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [month, setMonth]           = useState(nowMonth);
  const [summary, setSummary]       = useState(null);
  const [checkingIn, setCheckingIn] = useState({});
  const [refundMonth, setRefundMonth] = useState(nowMonth);
  const [requesting, setRequesting] = useState(false);

  // Always loads today — students cannot access other dates
  const loadDaily = useCallback(() => {
    setLoadingDaily(true);
    api.get(`/mess/meals/${today}`, token)
      .then(data => { setDailyMeals(data); setLoadingDaily(false); });
  }, [today, token]);

  const loadSummary = useCallback(() => {
    api.get(`/mess/monthly-summary?month=${month}`, token)
      .then(data => setSummary(data));
  }, [month, token]);

  useEffect(() => { loadDaily(); }, [loadDaily]);
  useEffect(() => { if (view === "monthly") loadSummary(); }, [view, loadSummary]);

  const handleCheckIn = async (mealType) => {
    setCheckingIn(c => ({ ...c, [mealType]: true }));
    // No date in body — server derives today server-side
    const data = await api.post("/mess/checkin", { mealType }, token);
    setCheckingIn(c => ({ ...c, [mealType]: false }));
    if (data.checkin) {
      toast(`Checked in for ${mealType}`, "success");
      loadDaily();
    } else {
      toast(data.message || "Error", "error");
    }
  };

  const handleRefund = async (e) => {
    e.preventDefault();
    setRequesting(true);
    const data = await api.post("/mess/request-refund", { month: refundMonth }, token);
    setRequesting(false);
    if (data.refundRequest) {
      toast(`Refund of ₹${data.refundRequest.refundAmount} requested`, "success");
    } else {
      toast(data.message || "Error", "error");
    }
  };

  return (
    <div>
      <div className="flex-gap mb-2">
        {["today", "monthly", "refund"].map(v => (
          <button
            key={v}
            className={`event-chip ${view === v ? "selected" : ""}`}
            onClick={() => setView(v)}
          >
            {v === "today" ? "Today's Meals" : v === "monthly" ? "Monthly Summary" : "Request Refund"}
          </button>
        ))}
      </div>

      {view === "today" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Meal Check-in</span>
            {/* Date badge — read-only, always today */}
            <span style={{
              fontSize: 12, color: "var(--ink-3)",
              background: "var(--bg-2)", borderRadius: 6,
              padding: "3px 10px", border: "1px solid var(--border)",
            }}>
              {today}
            </span>
          </div>
          <div className="card-body">
            {loadingDaily ? (
              <div className="empty-state"><span className="spinner" /></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {MEALS.map(meal => {
                  const info    = dailyMeals?.meals?.find(m => m.mealType === meal);
                  const checked = info?.checkedIn;
                  return (
                    <div
                      key={meal}
                      style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, textTransform: "capitalize" }}>{meal}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>₹{COST_PER_MEAL}</div>
                      </div>
                      {checked ? (
                        <span className="badge badge-green">✓ Attended</span>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={checkingIn[meal]}
                          onClick={() => handleCheckIn(meal)}
                        >
                          {checkingIn[meal]
                            ? <span className="spinner" style={{ width: 12, height: 12 }} />
                            : "Check In"}
                        </button>
                      )}
                    </div>
                  );
                })}
                {dailyMeals?.summary && (
                  <div style={{
                    marginTop: 8, padding: 12,
                    background: "var(--bg-2)", borderRadius: 8, fontSize: 13,
                  }}>
                    <div className="flex-between">
                      <span>Attended</span>
                      <strong>{dailyMeals.summary.attended} meals</strong>
                    </div>
                    <div className="flex-between">
                      <span>Cost incurred</span>
                      <strong>₹{dailyMeals.summary.costIncurred}</strong>
                    </div>
                    <div className="flex-between">
                      <span>Refund due today</span>
                      <strong>₹{dailyMeals.summary.refundDue}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "monthly" && (
        <div>
          <div className="card mb-2">
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="form-label" style={{ margin: 0 }}>Month</label>
              <input
                type="month"
                className="form-input"
                style={{ width: "auto" }}
                value={month}
                onChange={e => setMonth(e.target.value)}
              />
              <button className="btn btn-sm" onClick={loadSummary}>Load</button>
            </div>
          </div>
          {summary?.summary && (
            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Summary — {month}</span>
                </div>
                <div className="card-body">
                  {[
                    ["Days in month",        summary.summary.daysInMonth],
                    ["Total meals expected", summary.summary.totalMealsExpected],
                    ["Meals attended",       summary.summary.mealsAttended],
                    ["Meals missed",         summary.summary.mealsMissed],
                    ["Cost incurred",       `₹${summary.summary.costIncurred}`],
                    ["Refund due",          `₹${summary.summary.refundDue}`],
                    ["Attendance",           summary.summary.attendancePercentage],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="flex-between"
                      style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}
                    >
                      <span style={{ color: "var(--ink-2)" }}>{label}</span>
                      <strong>{val}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">Day-wise</span></div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Date</th><th>Attended</th><th>Missed</th></tr></thead>
                      <tbody>
                        {Object.entries(summary.dayWiseSummary || {}).map(([d, info]) => (
                          <tr key={d}>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d}</td>
                            <td><span className="badge badge-green">{info.attended}</span></td>
                            <td>
                              <span className={`badge badge-${info.missed > 0 ? "red" : "gray"}`}>
                                {info.missed}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "refund" && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Request Monthly Refund</span></div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>
              Submit a refund request for meals you missed this month.
              Refunds are calculated at ₹{COST_PER_MEAL}/meal.
            </p>
            <form onSubmit={handleRefund}>
              <div className="form-group">
                <label className="form-label">Month</label>
                <input
                  type="month"
                  className="form-input"
                  value={refundMonth}
                  onChange={e => setRefundMonth(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={requesting}>
                {requesting ? <span className="spinner" /> : "Submit Refund Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Groups Tab ─────────────────────────────────────────────────
function GroupsTab({ studentId, token }) {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/students/${studentId}/groups`, token)
      .then(d => { setGroups(d.groups || []); setLoading(false); });
  }, [studentId, token]);

  const typeColor = { TEACHER: "blue", BUS: "amber", LAUNDRY: "green", MESS: "red" };
  const typeLabel = { TEACHER: "Academic", BUS: "Transport", LAUNDRY: "Laundry", MESS: "Mess" };

  return (
    <div>
      {loading ? (
        <div className="empty-state"><span className="spinner" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {groups.map(g => (
            <div key={g.groupId} className="card">
              <div className="card-body">
                <div className="flex-between mb-1">
                  <span className={`badge badge-${typeColor[g.type] || "gray"}`}>
                    {typeLabel[g.type] || g.type}
                  </span>
                </div>
                <div style={{ fontWeight: 500, fontSize: 14, marginTop: 8 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{g.ownerId}</div>
              </div>
            </div>
          ))}
          {groups.length === 0 && <div className="empty-state">No groups yet</div>}
        </div>
      )}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────
function ProfileTab({ studentId, token }) {
  const toast = useToast();
  const [student, setStudent]           = useState(null);
  const [notifStatus, setNotifStatus]   = useState("unknown"); // "granted" | "denied" | "unknown"
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    api.get(`/students/${studentId}`, token).then(d => setStudent(d.student));
    // Reflect current browser permission state
    if ("Notification" in window) {
      setNotifStatus(Notification.permission);
    }
  }, [studentId, token]);

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      const { requestFCMToken } = await import("../lib/firebase");
      const { api: apiLib } = await import("../lib/api");
      const fcmToken = await requestFCMToken();
      if (fcmToken) {
        await apiLib.put(`/students/${studentId}/fcm-token`, { fcmToken }, token);
        setNotifStatus("granted");
        toast("Push notifications enabled!", "success");
      } else {
        setNotifStatus(Notification.permission);
        toast("Permission denied — please allow notifications in your browser settings", "error");
      }
    } catch (err) {
      toast("Failed to enable push notifications", "error");
    }
    setEnablingPush(false);
  };

  if (!student) return <div className="empty-state"><span className="spinner" /></div>;

  const rows = [
    ["Email",        student.email],
    ["Roll No",      student.rollNo],
    ["Department",   student.department  || "—"],
    ["Semester",     student.semester    || "—"],
    ["Hostel Block", student.hostelBlock || "—"],
    ["Role",         student.role],
  ];

  const pushEnabled  = notifStatus === "granted";
  const pushDenied   = notifStatus === "denied";

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header"><span className="card-title">Profile</span></div>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "var(--ink)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 500,
            }}>
              {student.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 16 }}>{student.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Student</div>
            </div>
          </div>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {rows.map(([label, val]) => (
                <tr key={label}>
                  <td style={{ color: "var(--ink-3)", padding: "5px 0", width: "40%" }}>{label}</td>
                  <td style={{ padding: "5px 0" }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Push notifications</span></div>
        <div className="card-body">
          {pushEnabled ? (
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", background: "var(--green-bg)",
                borderRadius: 8, marginBottom: 12,
              }}>
                <span style={{ color: "var(--green)", fontSize: 18 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--green)" }}>Enabled</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                    You will receive push notifications for bus alerts, laundry, mess updates and more.
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-3)" }}>
                To disable, turn off notifications for this site in your browser settings.
              </p>
            </div>
          ) : pushDenied ? (
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", background: "var(--red-bg)",
                borderRadius: 8, marginBottom: 12,
              }}>
                <span style={{ color: "var(--red)", fontSize: 18 }}>✕</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--red)" }}>Blocked</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                    Notifications are blocked. To enable them, click the lock icon in your browser address bar and allow notifications, then reload the page.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>
                Enable push notifications to get instant alerts for bus delays, laundry slots, mess updates and more — even when this tab is in the background.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleEnablePush}
                disabled={enablingPush}
              >
                {enablingPush
                  ? <><span className="spinner" /> Enabling…</>
                  : "Enable push notifications"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Student Dashboard ─────────────────────────────────────
export default function StudentDashboard({ currentPage }) {
  const { token, user } = useAuth();

  const renderPage = () => {
    switch (currentPage) {
      case "notifications": return <NotificationsTab studentId={user.id} token={token} />;
      case "laundry":       return <LaundryTab token={token} />;
      case "mess":          return <MessTab token={token} />;
      case "groups":        return <GroupsTab studentId={user.id} token={token} />;
      case "profile":       return <ProfileTab studentId={user.id} token={token} />;
      default:              return <NotificationsTab studentId={user.id} token={token} />;
    }
  };

  return <div>{renderPage()}</div>;
}
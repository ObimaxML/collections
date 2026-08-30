import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "http://localhost:8000/api";

interface Tenant {
  id: string;
  name: string;
  code: string;
}

interface Summary {
  debt_book: number;
  total_arrears: number;
  recovered: number;
  outstanding: number;
  recovery_rate: number;
  total_accounts: number;
  active_cases: number;
  broken_promises: number;
}

interface WorkItem {
  case_id: string;
  account_id: string;
  account_number: string;
  customer_name: string | null;
  mobile: string | null;
  arrears: string;
  balance: string;
  days_in_arrears: number;
  case_status: string;
  case_priority: number;
  strategy_code: string | null;
  assigned_to: string | null;
  next_action: string;
  priority_score: number;
  promise_due_date: string | null;
  promise_amount: string | null;
  promise_status: string | null;
}

interface Account360 {
  id: string;
  account_number: string;
  account_status: string;
  balance: string;
  arrears: string;
  days_in_arrears: number;
  last_payment_date: string | null;
  last_payment_amount: string;
  customer: {
    first_name: string | null;
    last_name: string | null;
    id_number: string | null;
    mobile: string | null;
    email: string | null;
  } | null;
  property: {
    property_reference: string | null;
    address: string | null;
  } | null;
  active_case: {
    id: string;
    status: string;
    priority: number;
    strategy_code: string | null;
    assigned_to: string | null;
  } | null;
  cases: any[];
  payments: any[];
  promises: any[];
  payment_plans: any[];
}

function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [view, setView] = useState<"dashboard" | "workqueue" | "accounts" | "imports" | "users">("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workQueue, setWorkQueue] = useState<WorkItem[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [account360, setAccount360] = useState<Account360 | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "contact" | "ptp" | "plan" | "payments">("overview");

  // New User Creation form for SuperAdmin
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("ADMIN");
  const [newTenantId, setNewTenantId] = useState("");

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("cos_user_v2");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loginEmail, setLoginEmail] = useState("admin@collectionsos.gov.za");
  const [loginPassword, setLoginPassword] = useState("Admin@2026!");
  const [loginError, setLoginError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail || "Login failed");
        return;
      }
      localStorage.setItem("cos_user_v2", JSON.stringify(data.user));
      setCurrentUser(data.user);
      if (data.user.tenant_id) {
        setSelectedTenant(data.user.tenant_id);
      }
    } catch (err: any) {
      setLoginError("Could not reach backend API");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("cos_user_v2");
    localStorage.removeItem("cos_user");
    setCurrentUser(null);
  };
  const [contactOutcome, setContactOutcome] = useState("CUSTOMER_ENGAGED");
  const [contactChannel, setContactChannel] = useState("PHONE");
  const [contactNotes, setContactNotes] = useState("");
  const [contactNextAction, setContactNextAction] = useState("CREATE_PAYMENT_PLAN");

  // PTP form
  const [ptpAmount, setPtpAmount] = useState("");
  const [ptpDueDate, setPtpDueDate] = useState("");

  // Plan form
  const [planDeposit, setPlanDeposit] = useState("1000");
  const [planInstallment, setPlanInstallment] = useState("2000");
  const [planFrequency, setPlanFrequency] = useState("MONTHLY");

  // Import file
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Quick Payment form
  const [paymentAmount, setPaymentAmount] = useState("1000");
  const [paymentRef, setPaymentRef] = useState(`PAY-${Date.now().toString().slice(-4)}`);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  // Load tenants on start
  useEffect(() => {
    // Default tenant or fetch
    const defaultTenantId = "e7a50839-7456-4b94-89f6-c3996cd123b6";
    setTenants([
      { id: "e7a50839-7456-4b94-89f6-c3996cd123b6", name: "Demo Municipality", code: "DEMO" },
      { id: "6eb315b0-7df2-449a-a0d7-bb6b24db6225", name: "Demo Municipality 2", code: "DEMO2" }
    ]);
    setSelectedTenant(defaultTenantId);
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    refreshData();
  }, [selectedTenant]);

  const refreshData = () => {
    if (!selectedTenant) return;
    // 1. Dashboard summary
    fetch(`${API}/dashboard/summary?tenant_id=${selectedTenant}`)
      .then(r => r.json())
      .then(setSummary)
      .catch(console.error);

    // 2. Work Queue
    fetch(`${API}/work-queue?tenant_id=${selectedTenant}`)
      .then(r => r.json())
      .then(setWorkQueue)
      .catch(console.error);

    // 3. Accounts
    fetch(`${API}/accounts?tenant_id=${selectedTenant}`)
      .then(r => r.json())
      .then(setAccounts)
      .catch(console.error);

    // 4. Users list
    fetch(`${API}/auth/users`)
      .then(r => r.json())
      .then(setUsersList)
      .catch(console.error);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newFullName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          tenant_id: newTenantId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error creating user: ${data.detail}`);
        return;
      }
      alert(`User ${data.full_name} (${data.role}) created successfully!`);
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      refreshData();
    } catch (err: any) {
      alert("Could not reach backend server");
    } finally {
      setLoading(false);
    }
  };

  const openAccountWorkbench = (accountId: string) => {
    setSelectedAccountId(accountId);
    fetch(`${API}/accounts/${accountId}/360?tenant_id=${selectedTenant}`)
      .then(r => r.json())
      .then(data => {
        setAccount360(data);
        if (data.arrears) {
          setPtpAmount((Number(data.arrears) / 2).toFixed(2));
        }
      })
      .catch(console.error);
  };

  const recordContact = async () => {
    if (!account360?.active_case?.id) return;
    setLoading(true);
    try {
      await fetch(`${API}/cases/${account360.active_case.id}/contacts?tenant_id=${selectedTenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: "collector-001",
          channel: contactChannel,
          outcome: contactOutcome,
          notes: contactNotes,
          next_action: contactNextAction,
        }),
      });
      openAccountWorkbench(account360.id);
      refreshData();
      alert("Contact attempt logged & case updated!");
    } finally {
      setLoading(false);
    }
  };

  const createPtp = async () => {
    if (!account360?.active_case?.id) return;
    setLoading(true);
    try {
      await fetch(`${API}/cases/${account360.active_case.id}/promises?tenant_id=${selectedTenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(ptpAmount),
          due_date: ptpDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          actor: "collector-001",
        }),
      });
      openAccountWorkbench(account360.id);
      refreshData();
      alert("Promise to Pay created successfully!");
    } finally {
      setLoading(false);
    }
  };

  const createPaymentPlan = async () => {
    if (!account360?.active_case?.id) return;
    setLoading(true);
    try {
      const calc = await fetch(
        `${API}/cases/${account360.active_case.id}/payment-plan-calculator?tenant_id=${selectedTenant}&deposit_amount=${planDeposit}&installment_amount=${planInstallment}`
      ).then(r => r.json());

      await fetch(`${API}/cases/${account360.active_case.id}/payment-plans?tenant_id=${selectedTenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deposit_amount: Number(planDeposit),
          installment_amount: Number(planInstallment),
          frequency: planFrequency,
          number_of_installments: calc.number_of_installments || 4,
          start_date: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
          actor: "collector-001",
        }),
      });
      openAccountWorkbench(account360.id);
      refreshData();
      alert("Payment arrangement activated!");
    } finally {
      setLoading(false);
    }
  };

  const captureAndReconcilePayment = async () => {
    if (!account360) return;
    setLoading(true);
    try {
      // 1. Create payment
      const pRes = await fetch(`${API}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          account_id: account360.id,
          amount: Number(paymentAmount),
          payment_date: paymentDate,
          external_reference: paymentRef,
          actor: "collector-001",
        }),
      });
      const paymentData = await pRes.json();
      if (!pRes.ok) {
        alert(`Payment error: ${paymentData.detail}`);
        return;
      }

      // 2. Reconcile payment
      const rRes = await fetch(`${API}/payments/${paymentData.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          actor: "collector-001",
        }),
      });
      const reconData = await rRes.json();
      alert(`Payment of R ${reconData.amount} captured and reconciled!\nNew Arrears: R ${reconData.new_arrears}`);
      setPaymentRef(`PAY-${Date.now().toString().slice(-4)}`);
      openAccountWorkbench(account360.id);
      refreshData();
    } finally {
      setLoading(false);
    }
  };

  const triggerCaseEngine = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/cases/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          min_arrears: 500,
          min_days_in_arrears: 30,
          actor: "admin",
        }),
      });
      const data = await res.json();
      alert(`Case Engine Completed!\nCreated: ${data.cases_created}\nUpdated: ${data.cases_updated}`);
      refreshData();
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API}/imports/accounts?tenant_id=${selectedTenant}&actor=admin`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setImportResult(data);
      refreshData();
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)", padding: "20px" }}>
        <div className="glass-panel" style={{ width: "440px", maxWidth: "100%", padding: "40px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15, 23, 42, 0.85)" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div className="brand-icon" style={{ margin: "0 auto 16px", width: "52px", height: "52px", fontSize: "26px" }}>C</div>
            <h2 style={{ fontFamily: "Outfit", color: "white", fontSize: "26px", marginBottom: "6px", fontWeight: 700 }}>CollectionsOS</h2>
            <p className="muted" style={{ fontSize: "13.5px" }}>South Africa Municipal Debt Recovery Operating System</p>
          </div>

          {loginError && (
            <div style={{ background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#fb7185", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "18px" }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="form-input"
                placeholder="name@municipality.gov.za"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: "24px" }}>
              <label style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: "14px", fontWeight: 600 }}>
              🔐 Sign In to Workspace
            </button>
          </form>

          <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "12px" }}>
            <span style={{ color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", display: "block", marginBottom: "10px" }}>
              1-Click Demo Credentials:
            </span>
            <div style={{ display: "grid", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px" }}
                onClick={() => {
                  setLoginEmail("superadmin@collectionsos.gov.za");
                  setLoginPassword("SuperAdmin@2026!");
                }}
              >
                👑 <strong>SuperAdmin</strong> (Global Oversight)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px" }}
                onClick={() => {
                  setLoginEmail("admin@collectionsos.gov.za");
                  setLoginPassword("Admin@2026!");
                }}
              >
                🏛️ <strong>Municipality Admin</strong> (Collections Ops)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-icon">C</div>
          <div className="brand-info">
            <h1>CollectionsOS</h1>
            <span>{currentUser?.role ?? "ENTERPRISE"}</span>
          </div>
        </div>

        {currentUser && (
          <div style={{ padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", marginBottom: "20px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>{currentUser.full_name}</div>
            <div style={{ fontSize: "11.5px", color: "var(--accent-sky)", marginBottom: "8px" }}>{currentUser.email}</div>
            <button className="btn btn-secondary btn-sm" style={{ width: "100%", fontSize: "11px", padding: "4px" }} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        )}

        <nav className="nav-group">
          <div className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
            📊 Dashboard
          </div>
          <div className={`nav-item ${view === "workqueue" ? "active" : ""}`} onClick={() => setView("workqueue")}>
            🎯 Work Queue
            <span className="nav-badge urgent">{workQueue.length}</span>
          </div>
          <div className={`nav-item ${view === "accounts" ? "active" : ""}`} onClick={() => setView("accounts")}>
            📑 Debt Books & Accounts
            <span className="nav-badge">{accounts.length}</span>
          </div>
          <div className={`nav-item ${view === "imports" ? "active" : ""}`} onClick={() => setView("imports")}>
            📥 Import Engine
          </div>
          <div className={`nav-item ${view === "users" ? "active" : ""}`} onClick={() => setView("users")}>
            👥 User Management & Roles
            <span className="nav-badge">{usersList.length}</span>
          </div>
        </nav>

        <div className="tenant-selector">
          <label>Active Municipality</label>
          <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <header className="top-bar">
          <div className="view-heading">
            <h2>
              {view === "dashboard" && "Executive Collections Dashboard"}
              {view === "workqueue" && "Prioritized Daily Collector Work Queue"}
              {view === "accounts" && "Municipal Debt Book & Accounts"}
              {view === "imports" && "Bulk Data Import & Upsert Engine"}
              {view === "users" && "System User Management & Role-Based Access Control"}
            </h2>
            <p>
              {view === "dashboard" && "Real-time debt recovery, cash collections, and portfolio status"}
              {view === "workqueue" && "Algorithmically ranked accounts ready for collector action"}
              {view === "accounts" && "Direct access to debtor records, contact details, and account 360° views"}
              {view === "imports" && "Upload CSV / XLSX files with automated field mapping and duplicate protection"}
              {view === "users" && "Provision new administrative and collector accounts and configure permissions"}
            </p>
          </div>

          <div className="top-actions">
            <button className="btn btn-secondary" onClick={refreshData}>🔄 Refresh</button>
            <button className="btn btn-primary" onClick={triggerCaseEngine} disabled={loading}>
              ⚡ Run Case Engine
            </button>
          </div>
        </header>

        {/* METRICS ROW */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Total Debt Book</span>
              <span className="metric-badge badge-blue">Portfolio</span>
            </div>
            <div className="metric-value">{money(summary?.debt_book)}</div>
            <div className="metric-subtitle">{summary?.total_accounts ?? 0} active accounts</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Total Arrears</span>
              <span className="metric-badge badge-amber">Overdue</span>
            </div>
            <div className="metric-value">{money(summary?.total_arrears)}</div>
            <div className="metric-subtitle">Collectable exposure</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Recovered Cash</span>
              <span className="metric-badge badge-green">Reconciled</span>
            </div>
            <div className="metric-value">{money(summary?.recovered)}</div>
            <div className="metric-subtitle">Recovery Rate: {summary?.recovery_rate ?? 0}%</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Active Cases</span>
              <span className="metric-badge badge-rose">{summary?.broken_promises ?? 0} Broken PTP</span>
            </div>
            <div className="metric-value">{summary?.active_cases ?? 0}</div>
            <div className="metric-subtitle">Operational queue volume</div>
          </div>
        </section>

        {/* VIEW CONTENT */}
        {view === "dashboard" && (
          <div>
            <div className="glass-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Top Collector Priority Queue</h3>
                  <p>Highest impact collection cases ranked by arrears, days overdue, and risk</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setView("workqueue")}>View Full Queue</button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Score</th>
                      <th>Account</th>
                      <th>Debtor</th>
                      <th>Arrears</th>
                      <th>DPD</th>
                      <th>Status</th>
                      <th>Next Action</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workQueue.slice(0, 5).map(item => (
                      <tr key={item.case_id}>
                        <td><strong style={{ color: "#818cf8" }}>{item.priority_score}</strong></td>
                        <td><strong>{item.account_number}</strong></td>
                        <td>{item.customer_name ?? "—"}</td>
                        <td style={{ color: "#f87171", fontWeight: 600 }}>{money(item.arrears)}</td>
                        <td>{item.days_in_arrears} days</td>
                        <td><span className={`status-pill status-${item.case_status.toLowerCase()}`}>{item.case_status}</span></td>
                        <td><span style={{ fontSize: "12px", color: "#38bdf8" }}>{item.next_action}</span></td>
                        <td>
                          <button className="table-action-btn" onClick={() => openAccountWorkbench(item.account_id)}>
                            Open 360°
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === "workqueue" && (
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Collector Daily Work Queue ({workQueue.length} Accounts)</h3>
                <p>Prioritized work order based on DPD, Arrears, PTP, and Broken Promises</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Account</th>
                    <th>Debtor Name</th>
                    <th>Mobile</th>
                    <th>Arrears</th>
                    <th>DPD</th>
                    <th>Strategy</th>
                    <th>Status</th>
                    <th>Recommended Next Action</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workQueue.map(item => (
                    <tr key={item.case_id}>
                      <td><strong style={{ color: "#818cf8", fontSize: "15px" }}>{item.priority_score}</strong></td>
                      <td><strong>{item.account_number}</strong></td>
                      <td>{item.customer_name ?? "—"}</td>
                      <td>{item.mobile ?? "—"}</td>
                      <td style={{ color: "#f87171", fontWeight: 600 }}>{money(item.arrears)}</td>
                      <td>{item.days_in_arrears} DPD</td>
                      <td><span style={{ fontSize: "12px", color: "#cbd5e1" }}>{item.strategy_code ?? "STANDARD"}</span></td>
                      <td><span className={`status-pill status-${item.case_status.toLowerCase()}`}>{item.case_status}</span></td>
                      <td><strong style={{ color: "#38bdf8", fontSize: "12px" }}>{item.next_action}</strong></td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => openAccountWorkbench(item.account_id)}>
                          Work Case
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "accounts" && (
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Municipal Debt Book ({accounts.length} Accounts)</h3>
                <p>Complete debtor ledger with balance, arrears, and collection statuses</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Account Number</th>
                    <th>Status</th>
                    <th>Balance</th>
                    <th>Arrears</th>
                    <th>DPD</th>
                    <th>Last Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr key={acc.id}>
                      <td><strong>{acc.account_number}</strong></td>
                      <td><span className="status-pill status-new">{acc.account_status}</span></td>
                      <td>{money(acc.balance)}</td>
                      <td style={{ color: "#f87171", fontWeight: 600 }}>{money(acc.arrears)}</td>
                      <td>{acc.days_in_arrears} days</td>
                      <td>{acc.last_payment_date ? `${acc.last_payment_date} (${money(acc.last_payment_amount)})` : "None"}</td>
                      <td>
                        <button className="table-action-btn" onClick={() => openAccountWorkbench(acc.id)}>
                          Workbench
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "imports" && (
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Municipal Account Import Engine</h3>
                <p>Safe ingestion with automated column mapping, customer upsert, and duplicate prevention</p>
              </div>
            </div>

            <div style={{ maxWidth: "600px", padding: "20px 0" }}>
              <div className="form-group">
                <label>Select CSV or Excel (.xlsx) file</label>
                <input type="file" accept=".csv,.xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} className="form-input" />
              </div>
              <button className="btn btn-primary" onClick={handleImport} disabled={!file || loading}>
                {loading ? "Importing Data..." : "🚀 Ingest & Upsert Debt Book"}
              </button>

              {importResult && (
                <div style={{ marginTop: "24px" }} className="drawer-section">
                  <div className="drawer-section-title">Import Summary Results</div>
                  <div className="info-grid">
                    <div className="info-item"><label>Total Rows</label><span className="info-value">{importResult.total_rows}</span></div>
                    <div className="info-item"><label>Created Accounts</label><span className="info-value" style={{ color: "#34d399" }}>{importResult.created}</span></div>
                    <div className="info-item"><label>Updated Accounts</label><span className="info-value" style={{ color: "#38bdf8" }}>{importResult.updated}</span></div>
                    <div className="info-item"><label>Skipped / Errors</label><span className="info-value" style={{ color: "#fb7185" }}>{importResult.skipped}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "users" && (
          <div>
            {/* Create User Card */}
            <div className="glass-panel" style={{ marginBottom: "28px" }}>
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Provision New User & Role</h3>
                  <p>Create SuperAdmins, Municipal Admins, Team Supervisors, and Debt Collectors</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} style={{ maxWidth: "800px" }}>
                <div className="info-grid" style={{ marginBottom: "16px" }}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sipho Sithole"
                      value={newFullName}
                      onChange={e => setNewFullName(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Work Email</label>
                    <input
                      type="email"
                      placeholder="e.g. sipho@municipality.gov.za"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="info-grid" style={{ marginBottom: "16px" }}>
                  <div className="form-group">
                    <label>Temporary Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>User Role & Access Scope</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      className="form-select"
                    >
                      <option value="SUPERADMIN">👑 SUPERADMIN (Global System Oversight)</option>
                      <option value="ADMIN">🏛️ ADMIN (Municipality Administrator)</option>
                      <option value="COLLECTOR">🎯 COLLECTOR (Work Queue & Debtor Engagement)</option>
                      <option value="AUDITOR">📑 AUDITOR (Read-Only Financial Logs)</option>
                    </select>
                  </div>
                </div>

                {newRole !== "SUPERADMIN" && (
                  <div className="form-group" style={{ marginBottom: "20px" }}>
                    <label>Assign to Municipality</label>
                    <select
                      value={newTenantId || selectedTenant}
                      onChange={e => setNewTenantId(e.target.value)}
                      className="form-select"
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Creating User..." : "➕ Create User Account"}
                </button>
              </form>
            </div>

            {/* Users Table */}
            <div className="glass-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Active System Users ({usersList.length})</h3>
                  <p>All authenticated personnel with active role access</p>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Municipality Scope</th>
                      <th>Status</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id}>
                        <td><strong>{u.full_name}</strong></td>
                        <td style={{ color: "#38bdf8" }}>{u.email}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              u.role === "SUPERADMIN"
                                ? "status-broken"
                                : u.role === "ADMIN"
                                ? "status-engaged"
                                : "status-new"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>
                          {u.tenant_id
                            ? tenants.find(t => t.id === u.tenant_id)?.name ?? "Municipality User"
                            : "🌐 Global All Municipalities"}
                        </td>
                        <td>
                          <span className="status-pill status-paying">Active</span>
                        </td>
                        <td style={{ color: "#94a3b8" }}>{u.created_at?.split("T")[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* COLLECTOR 360 WORKBENCH DRAWER */}
      {selectedAccountId && account360 && (
        <div className="modal-backdrop" onClick={() => setSelectedAccountId(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">
                <h2>{account360.account_number}</h2>
                <p className="muted">Account 360° Collector Workbench</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAccountId(null)}>✕ Close</button>
            </div>

            {/* Debtor Profile */}
            <div className="drawer-section">
              <div className="drawer-section-title">👤 Customer & Property Master</div>
              <div className="info-grid">
                <div className="info-item">
                  <label>Full Name</label>
                  <span className="info-value">{account360.customer ? `${account360.customer.first_name} ${account360.customer.last_name}` : "Not Assigned"}</span>
                </div>
                <div className="info-item">
                  <label>ID / Registration</label>
                  <span className="info-value">{account360.customer?.id_number ?? "—"}</span>
                </div>
                <div className="info-item">
                  <label>Mobile Contact</label>
                  <span className="info-value" style={{ color: "#38bdf8" }}>{account360.customer?.mobile ?? "—"}</span>
                </div>
                <div className="info-item">
                  <label>Address</label>
                  <span className="info-value">{account360.property?.address ?? "No linked property"}</span>
                </div>
              </div>
            </div>

            {/* Financial Status */}
            <div className="drawer-section">
              <div className="drawer-section-title">💰 Account Arrears Breakdown</div>
              <div className="info-grid">
                <div className="info-item"><label>Total Balance</label><span className="info-value">{money(account360.balance)}</span></div>
                <div className="info-item"><label>Overdue Arrears</label><span className="info-value" style={{ color: "#f87171", fontWeight: 700 }}>{money(account360.arrears)}</span></div>
                <div className="info-item"><label>Days in Arrears</label><span className="info-value">{account360.days_in_arrears} Days</span></div>
                <div className="info-item"><label>Case Status</label><span className="info-value"><span className="status-pill status-engaged">{account360.active_case?.status ?? "NO CASE"}</span></span></div>
              </div>
            </div>

            {/* Workbench Actions Tabs */}
            <div className="tabs">
              <div className={`tab ${drawerTab === "overview" ? "active" : ""}`} onClick={() => setDrawerTab("overview")}>Timeline</div>
              <div className={`tab ${drawerTab === "contact" ? "active" : ""}`} onClick={() => setDrawerTab("contact")}>Log Contact</div>
              <div className={`tab ${drawerTab === "ptp" ? "active" : ""}`} onClick={() => setDrawerTab("ptp")}>Create PTP</div>
              <div className={`tab ${drawerTab === "plan" ? "active" : ""}`} onClick={() => setDrawerTab("plan")}>Payment Plan</div>
              <div className={`tab ${drawerTab === "payments" ? "active" : ""}`} onClick={() => setDrawerTab("payments")}>Payments ({account360.payments.length})</div>
            </div>

            {drawerTab === "overview" && (
              <div className="drawer-section">
                <div className="drawer-section-title">Activity Timeline</div>
                <div className="timeline">
                  {account360.promises.map(p => (
                    <div key={p.id} className="timeline-item">
                      <div className="timeline-date">{p.created_at?.split("T")[0]} • Promise to Pay</div>
                      <div className="timeline-content">PTP of <strong>{money(p.amount)}</strong> due {p.due_date} (<span style={{ color: p.status === "KEPT" ? "#34d399" : p.status === "BROKEN" ? "#f87171" : "#fbbf24" }}>{p.status}</span>)</div>
                    </div>
                  ))}
                  {account360.payments.map(pm => (
                    <div key={pm.id} className="timeline-item">
                      <div className="timeline-date">{pm.payment_date} • Payment Received</div>
                      <div className="timeline-content">Received <strong>{money(pm.amount)}</strong> via {pm.external_reference} ({pm.reconciliation_status})</div>
                    </div>
                  ))}
                  {account360.payment_plans.map(pl => (
                    <div key={pl.id} className="timeline-item">
                      <div className="timeline-date">{pl.start_date} • Payment Arrangement</div>
                      <div className="timeline-content">{pl.number_of_installments} x <strong>{money(pl.installment_amount)}</strong> ({pl.frequency}) • {pl.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drawerTab === "contact" && (
              <div className="drawer-section">
                <div className="drawer-section-title">Log Debtor Contact Attempt</div>
                <div className="form-group">
                  <label>Channel</label>
                  <select value={contactChannel} onChange={e => setContactChannel(e.target.value)} className="form-select">
                    <option value="PHONE">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                    <option value="FIELD_VISIT">Field Visit</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Outcome</label>
                  <select value={contactOutcome} onChange={e => setContactOutcome(e.target.value)} className="form-select">
                    <option value="CUSTOMER_ENGAGED">Customer Engaged</option>
                    <option value="PROMISE_MADE">Promise Made (PTP)</option>
                    <option value="NO_ANSWER">No Answer</option>
                    <option value="WRONG_NUMBER">Wrong Number</option>
                    <option value="DISPUTE">Dispute Raised</option>
                    <option value="REFUSES_TO_PAY">Refuses to Pay (Escalate)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Collector Notes</label>
                  <textarea rows={3} value={contactNotes} onChange={e => setContactNotes(e.target.value)} className="form-textarea" placeholder="Enter conversation details..." />
                </div>
                <button className="btn btn-primary" onClick={recordContact} disabled={loading}>
                  Save Interaction & Update Case
                </button>
              </div>
            )}

            {drawerTab === "ptp" && (
              <div className="drawer-section">
                <div className="drawer-section-title">Capture Promise to Pay</div>
                <div className="form-group">
                  <label>Promised Amount (ZAR)</label>
                  <input type="number" value={ptpAmount} onChange={e => setPtpAmount(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Commitment Due Date</label>
                  <input type="date" value={ptpDueDate} onChange={e => setPtpDueDate(e.target.value)} className="form-input" />
                </div>
                <button className="btn btn-primary" onClick={createPtp} disabled={loading}>
                  Commit Promise to Pay
                </button>
              </div>
            )}

            {drawerTab === "plan" && (
              <div className="drawer-section">
                <div className="drawer-section-title">Setup Payment Arrangement</div>
                <div className="form-group">
                  <label>Upfront Deposit (ZAR)</label>
                  <input type="number" value={planDeposit} onChange={e => setPlanDeposit(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Monthly Installment (ZAR)</label>
                  <input type="number" value={planInstallment} onChange={e => setPlanInstallment(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={planFrequency} onChange={e => setPlanFrequency(e.target.value)} className="form-select">
                    <option value="MONTHLY">Monthly</option>
                    <option value="FORTNIGHTLY">Fortnightly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={createPaymentPlan} disabled={loading}>
                  Activate Payment Arrangement
                </button>
              </div>
            )}

            {drawerTab === "payments" && (
              <div className="drawer-section">
                <div className="drawer-section-title">💵 Capture & Post Reconciled Payment</div>
                <div className="info-grid" style={{ marginBottom: "16px" }}>
                  <div className="form-group">
                    <label>Payment Amount (ZAR)</label>
                    <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>External Reference / Bank Ref</label>
                    <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="form-input" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label>Payment Date</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="form-input" />
                </div>
                <button className="btn btn-success" onClick={captureAndReconcilePayment} disabled={loading || !paymentAmount} style={{ marginBottom: "24px" }}>
                  ✓ Post & Reconcile Payment (Reduce Arrears)
                </button>

                <div className="drawer-section-title">Account Payment History ({account360.payments.length})</div>
                {account360.payments.length === 0 ? (
                  <p className="muted">No payments recorded for this account.</p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Reference</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account360.payments.map(pm => (
                          <tr key={pm.id}>
                            <td>{pm.payment_date}</td>
                            <td><strong style={{ color: "#34d399" }}>{money(pm.amount)}</strong></td>
                            <td>{pm.external_reference ?? "—"}</td>
                            <td><span className="status-pill status-paying">{pm.reconciliation_status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function money(n: any) {
  return `R ${(Number(n) || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

createRoot(document.getElementById("root")!).render(<App />);

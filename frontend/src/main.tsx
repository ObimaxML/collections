import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = (import.meta as any).env?.VITE_API_URL || "/api";

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
  const [view, setView] = useState<"dashboard" | "workqueue" | "accounts" | "imports" | "users" | "settings">("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workQueue, setWorkQueue] = useState<WorkItem[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [account360, setAccount360] = useState<Account360 | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "contact" | "ptp" | "plan" | "payments">("overview");

  // New User Creation form for SuperAdmin / Admin
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("COLLECTOR");
  const [newTenantIds, setNewTenantIds] = useState<string[]>([]);

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editTenantIds, setEditTenantIds] = useState<string[]>([]);
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // Self Settings state
  const [settingsFullName, setSettingsFullName] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");

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

  // Import file & Step 63 Wizard states
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importMappingData, setImportMappingData] = useState<any>(null);
  const [importStage, setImportStage] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [customColumnMapping, setCustomColumnMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Quick Payment form
  const [paymentAmount, setPaymentAmount] = useState("1000");
  const [paymentRef, setPaymentRef] = useState(`PAY-${Date.now().toString().slice(-4)}`);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  // New Tenant Creation state
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantCode, setNewTenantCode] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter states
  const [wqSearch, setWqSearch] = useState("");
  const [wqStatusFilter, setWqStatusFilter] = useState("ALL");
  const [wqStrategyFilter, setWqStrategyFilter] = useState("ALL");

  const [accSearch, setAccSearch] = useState("");
  const [accStatusFilter, setAccStatusFilter] = useState("ALL");
  const [accMinArrears, setAccMinArrears] = useState("");

  // Load tenants dynamically on start
  const fetchTenants = () => {
    fetch(`${API}/tenants`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTenants(data);
          setSelectedTenant(prev => {
            const userAssigned = currentUser?.tenant_ids || (currentUser?.tenant_id ? [currentUser.tenant_id] : []);
            if (currentUser?.role !== "SUPERADMIN" && userAssigned.length > 0) {
              if (prev && userAssigned.includes(prev)) return prev;
              return userAssigned[0];
            }
            return prev || data[0].id;
          });
        } else {
          setTenants([
            { id: "9199c540-11dc-4ce0-bc70-922fccf25274", name: "City of Johannesburg", code: "JHB" },
            { id: "e7a50839-7456-4b94-89f6-c3996cd123b6", name: "Demo Municipality", code: "DEMO" },
          ]);
          setSelectedTenant(prev => prev || "9199c540-11dc-4ce0-bc70-922fccf25274");
        }
      })
      .catch(err => {
        console.error("Could not fetch tenants:", err);
        setTenants([
          { id: "9199c540-11dc-4ce0-bc70-922fccf25274", name: "City of Johannesburg", code: "JHB" },
          { id: "e7a50839-7456-4b94-89f6-c3996cd123b6", name: "Demo Municipality", code: "DEMO" },
        ]);
        setSelectedTenant(prev => prev || "9199c540-11dc-4ce0-bc70-922fccf25274");
      });
  };

  // Get municipalities accessible to the current user
  const accessibleTenants = tenants.filter(t => {
    if (!currentUser || currentUser.role === "SUPERADMIN") return true;
    const userAssigned = currentUser.tenant_ids || (currentUser.tenant_id ? [currentUser.tenant_id] : []);
    if (userAssigned.length === 0) return true;
    return userAssigned.includes(t.id);
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newTenantCode) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTenantName,
          code: newTenantCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error onboarding municipality: ${data.detail}`);
        return;
      }
      alert(`Municipality ${data.name} (${data.code}) onboarded successfully!`);
      setNewTenantName("");
      setNewTenantCode("");
      fetchTenants();
    } catch (err: any) {
      alert("Could not reach backend API");
    } finally {
      setLoading(false);
    }
  };

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
      .then(data => {
        if (Array.isArray(data)) {
          setWorkQueue(data);
        } else if (data && Array.isArray(data.items)) {
          // Normalize Step 34 work queue response
          const normalized = data.items.map((it: any) => ({
            case_id: it.case_id,
            account_id: it.account_id,
            account_number: it.account_number,
            customer_name: it.customer_name,
            mobile: it.mobile,
            arrears: it.arrears,
            balance: it.balance,
            days_in_arrears: it.days_in_arrears,
            case_status: it.status,
            case_priority: it.priority,
            strategy_code: it.strategy_code,
            assigned_to: it.assigned_to,
            next_action: it.strategy_code ? `Execute ${it.strategy_code}` : "Contact Debtor",
            priority_score: it.priority === 1 ? 95 : it.priority === 2 ? 75 : it.priority === 3 ? 50 : 25,
            promise_due_date: null,
            promise_amount: null,
            promise_status: null,
          }));
          setWorkQueue(normalized);
        } else {
          setWorkQueue([]);
        }
      })
      .catch(err => {
        console.error("Failed to load work queue", err);
        setWorkQueue([]);
      });

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
      const assigned = currentUser?.role === "ADMIN" 
        ? [currentUser.tenant_id || selectedTenant] 
        : newTenantIds;

      const res = await fetch(`${API}/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newFullName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          tenant_ids: assigned,
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
      setNewTenantIds([]);
      refreshData();
    } catch (err: any) {
      alert("Could not reach backend server");
    } finally {
      setLoading(false);
    }
  };

  const openEditUser = (user: any) => {
    setEditingUser(user);
    setEditFullName(user.full_name || "");
    setEditEmail(user.email || "");
    setEditRole(user.role || "COLLECTOR");
    setEditTenantIds(user.tenant_ids || (user.tenant_id ? [user.tenant_id] : []));
    setEditPassword("");
    setEditIsActive(user.is_active !== false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const payload: any = {
        full_name: editFullName,
        email: editEmail,
        role: editRole,
        is_active: editIsActive,
        tenant_ids: editTenantIds,
      };
      if (editPassword.trim()) {
        payload.password = editPassword;
      }

      const res = await fetch(`${API}/auth/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error updating user: ${data.detail}`);
        return;
      }
      alert(`User ${data.full_name} updated successfully!`);
      setEditingUser(null);
      refreshData();
      if (currentUser?.id === data.id) {
        setCurrentUser(data);
        localStorage.setItem("cos_user_v2", JSON.stringify(data));
      }
    } catch (err: any) {
      alert("Could not reach backend server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (settingsPassword && settingsPassword !== settingsConfirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        full_name: settingsFullName || currentUser.full_name,
        email: settingsEmail || currentUser.email,
      };
      if (settingsPassword.trim()) {
        payload.password = settingsPassword;
      }
      const res = await fetch(`${API}/auth/users/${currentUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error saving settings: ${data.detail}`);
        return;
      }
      alert("Profile updated successfully!");
      setCurrentUser(data);
      localStorage.setItem("cos_user_v2", JSON.stringify(data));
      setSettingsPassword("");
      setSettingsConfirmPassword("");
    } catch (err: any) {
      alert("Could not update profile: " + err.message);
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
      // 1. Post & reconcile payment in one authoritative step
      const pRes = await fetch(`${API}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          account_number: account360.account_number,
          amount: Number(paymentAmount),
          payment_date: paymentDate,
          external_reference: paymentRef,
          actor: currentUser?.email || "collector",
        }),
      });
      const paymentData = await pRes.json();
      if (!pRes.ok) {
        let msg = paymentData.detail;
        if (typeof msg === "object") {
          msg = Array.isArray(msg) ? msg.map((e: any) => `${e.loc?.join(".") || ""}: ${e.msg}`).join("\n") : JSON.stringify(msg);
        }
        alert(`Payment error: ${msg || "Could not process payment"}`);
        return;
      }

      alert(`✅ Payment of R ${Number(paymentAmount).toFixed(2)} posted successfully and arrears updated!`);
      setPaymentRef(`PAY-${Date.now().toString().slice(-4)}`);
      openAccountWorkbench(account360.id);
      refreshData();
    } catch (err: any) {
      alert(`Network error: ${err.message || err}`);
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

  const handleInspectFile = async (selectedFile?: File | null) => {
    const targetFile = selectedFile || file;
    if (!targetFile) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", targetFile);
    try {
      const res = await fetch(`${API}/imports/accounts/mapping`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Failed to inspect file.");
        return;
      }
      const data = await res.json();
      setImportMappingData(data);
      setCustomColumnMapping(data.mapping || {});
      setImportStage("mapping");
    } catch (e: any) {
      alert("Error inspecting file: " + e.message);
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
      const mappingParam = encodeURIComponent(JSON.stringify(customColumnMapping));
      const res = await fetch(`${API}/imports/accounts?tenant_id=${selectedTenant}&actor=${encodeURIComponent(currentUser?.full_name || "admin")}&mapping=${mappingParam}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setImportResult(data);
      setImportStage("result");
      refreshData();
    } catch (e: any) {
      alert("Error during import: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <div className="loan-emblem-wrapper">
              <div className="loan-emblem-bg"></div>
              <svg className="loan-svg-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 1. Green Money Sack with South African Rand 'R' */}
                <g className="rand-sack-group">
                  {/* Sack Tie Top Crown */}
                  <path d="M42 16 C38 6, 62 6, 58 16 Z" fill="#16a34a" stroke="#15803d" strokeWidth="2.5" strokeLinejoin="round"/>
                  <rect x="42" y="16" width="16" height="6" rx="3" fill="#22c55e" stroke="#16a34a" strokeWidth="1.5"/>
                  {/* Main Sack Body */}
                  <path d="M50 20 C32 20, 22 36, 22 56 C22 72, 34 76, 50 76 C66 76, 78 72, 78 56 C78 36, 68 20, 50 20 Z" fill="#16a34a" stroke="#15803d" strokeWidth="3" strokeLinejoin="round"/>
                  
                  {/* South African Rand 'R' Symbol */}
                  <text x="50" y="58" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="900" fontFamily="Outfit, sans-serif" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }}>
                    R
                  </text>
                </g>

                {/* 2. Golden Rosette Badge / Certification Seal */}
                <g className="rosette-badge-group">
                  {/* Rosette Ribbons */}
                  <path d="M14 55 L8 65 L16 63 L22 69 L20 57 Z" fill="#f59e0b"/>
                  {/* Outer Orange Circle */}
                  <circle cx="20" cy="46" r="16" fill="#f59e0b"/>
                  {/* Inner White Ring */}
                  <circle cx="20" cy="46" r="11" fill="#ffffff"/>
                  {/* Center Golden Core */}
                  <circle cx="20" cy="46" r="8" fill="#f59e0b"/>
                </g>

                {/* 3. Descending Debt Collection / Cash Flow Arrow */}
                <g className="down-recovery-arrow">
                  {/* Dotted Trail Indicator */}
                  <circle cx="82" cy="20" r="2.8" fill="#f59e0b"/>
                  <circle cx="88" cy="20" r="2.8" fill="#f59e0b"/>
                  <path d="M82 26 L82 32 M88 26 L88 32" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
                  {/* Downward Collection Arrow */}
                  <path d="M74 36 L96 36 L85 52 Z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round"/>
                </g>

                {/* 4. Supportive Debt Recovery Hand */}
                <g className="collector-hand-group">
                  {/* Cuff */}
                  <rect x="0" y="74" width="10" height="24" rx="2" fill="#94a3b8"/>
                  <rect x="10" y="73" width="10" height="26" rx="2" fill="#0f172a"/>
                  {/* Hand Body & Extended Palm */}
                  <path d="M20 83 C20 73, 30 65, 45 66 C58 67, 62 70, 62 74 C62 77, 54 77, 44 76 C40 76, 30 78, 25 84 L22 96 L68 96 C78 96, 88 90, 96 74 C97 73, 99 74, 98 76 C94 86, 82 98, 64 98 L20 98 Z" fill="#fca5a5" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                </g>
              </svg>
            </div>
            <h2>CollectionsOS</h2>
            <p>South African Municipal Debt Recovery & Revenue Operating System</p>
          </div>

          {loginError && <div className="login-error">{loginError}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Work Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="form-input"
                placeholder="name@municipality.gov.za"
                required
              />
            </div>

            <div className="form-group">
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
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="brand-section" style={{ margin: 0, padding: 0, alignItems: "center" }}>
          <div className="brand-icon" style={{ width: "36px", height: "36px" }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "26px", height: "26px" }}>
              {/* Green Money Sack */}
              <path d="M42 16 C38 6, 62 6, 58 16 Z" fill="#16a34a"/>
              <rect x="42" y="16" width="16" height="6" rx="3" fill="#22c55e"/>
              <path d="M50 20 C32 20, 22 36, 22 56 C22 72, 34 76, 50 76 C66 76, 78 72, 78 56 C78 36, 68 20, 50 20 Z" fill="#16a34a"/>
              <text x="50" y="58" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="900" fontFamily="Outfit, sans-serif">
                R
              </text>
              {/* Rosette Medal */}
              <circle cx="20" cy="46" r="14" fill="#f59e0b"/>
              <circle cx="20" cy="46" r="9" fill="#ffffff"/>
              <circle cx="20" cy="46" r="6" fill="#f59e0b"/>
              {/* Collection Arrow */}
              <path d="M74 36 L96 36 L85 52 Z" fill="#f59e0b"/>
              {/* Recovery Hand */}
              <path d="M20 83 C20 73, 30 65, 45 66 C58 67, 62 70, 62 74 C62 77, 54 77, 44 76 C40 76, 30 78, 25 84 L22 96 L68 96 C78 96, 88 90, 96 74 C97 73, 99 74, 98 76 C94 86, 82 98, 64 98 L20 98 Z" fill="#fca5a5"/>
            </svg>
          </div>
          <div className="brand-info">
            <h1 style={{ fontSize: "16px" }}>CollectionsOS</h1>
          </div>
        </div>
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand-section">
          <div className="brand-icon" title="CollectionsOS - South Africa Municipal Debt Recovery OS" style={{ width: "42px", height: "42px" }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "32px", height: "32px" }}>
              {/* Green Money Sack */}
              <path d="M42 16 C38 6, 62 6, 58 16 Z" fill="#16a34a"/>
              <rect x="42" y="16" width="16" height="6" rx="3" fill="#22c55e"/>
              <path d="M50 20 C32 20, 22 36, 22 56 C22 72, 34 76, 50 76 C66 76, 78 72, 78 56 C78 36, 68 20, 50 20 Z" fill="#16a34a"/>
              <text x="50" y="58" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="900" fontFamily="Outfit, sans-serif">
                R
              </text>
              {/* Rosette Medal */}
              <circle cx="20" cy="46" r="14" fill="#f59e0b"/>
              <circle cx="20" cy="46" r="9" fill="#ffffff"/>
              <circle cx="20" cy="46" r="6" fill="#f59e0b"/>
              {/* Collection Arrow */}
              <path d="M74 36 L96 36 L85 52 Z" fill="#f59e0b"/>
              {/* Recovery Hand */}
              <path d="M20 83 C20 73, 30 65, 45 66 C58 67, 62 70, 62 74 C62 77, 54 77, 44 76 C40 76, 30 78, 25 84 L22 96 L68 96 C78 96, 88 90, 96 74 C97 73, 99 74, 98 76 C94 86, 82 98, 64 98 L20 98 Z" fill="#fca5a5"/>
            </svg>
          </div>
          <div className="brand-info">
            <h1>CollectionsOS</h1>
            <span>{currentUser?.role ?? "ENTERPRISE"}</span>
          </div>
        </div>

        <div className="tenant-selector" style={{ marginBottom: "18px" }}>
          <label>Active Municipality ({accessibleTenants.length})</label>
          <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}>
            {accessibleTenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </div>

        <nav className="nav-group">
          <div className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => { setView("dashboard"); setMobileMenuOpen(false); }}>
            📊 Dashboard
          </div>
          <div className={`nav-item ${view === "workqueue" ? "active" : ""}`} onClick={() => { setView("workqueue"); setMobileMenuOpen(false); }}>
            🎯 Work Queue
            <span className="nav-badge urgent">{workQueue.length}</span>
          </div>
          <div className={`nav-item ${view === "accounts" ? "active" : ""}`} onClick={() => { setView("accounts"); setMobileMenuOpen(false); }}>
            📑 Debt Books & Accounts
            <span className="nav-badge">{accounts.length}</span>
          </div>
          <div className={`nav-item ${view === "imports" ? "active" : ""}`} onClick={() => { setView("imports"); setMobileMenuOpen(false); }}>
            📥 Import Engine
          </div>
          {currentUser?.role !== "COLLECTOR" && (
            <div className={`nav-item ${view === "users" ? "active" : ""}`} onClick={() => { setView("users"); setMobileMenuOpen(false); }}>
              👥 User Management & Roles
              <span className="nav-badge">{usersList.length}</span>
            </div>
          )}
          <div className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => { setView("settings"); setMobileMenuOpen(false); setSettingsFullName(currentUser?.full_name || ""); setSettingsEmail(currentUser?.email || ""); }}>
            ⚙️ Account Settings
          </div>
        </nav>

        {currentUser && (
          <div style={{ marginTop: "auto", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>{currentUser.full_name}</div>
              <button
                className="btn btn-secondary btn-sm"
                title="Sign Out"
                aria-label="Sign Out"
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: "rgba(244, 63, 94, 0.3)",
                  color: "#fb7185",
                  background: "rgba(244, 63, 94, 0.08)",
                  transition: "all 0.2s ease",
                }}
                onClick={handleLogout}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        )}
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
              {view === "settings" && "Account & Profile Settings"}
            </h2>
            <p>
              {view === "dashboard" && "Real-time debt recovery, cash collections, and portfolio status"}
              {view === "workqueue" && "Algorithmically ranked accounts ready for collector action"}
              {view === "accounts" && "Direct access to debtor records, contact details, and account 360° views"}
              {view === "imports" && "Upload CSV / XLSX files with automated field mapping and duplicate protection"}
              {view === "users" && "Provision new administrative and collector accounts and configure permissions"}
              {view === "settings" && "Update your personal details, email address, and account password"}
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

              {/* Desktop Table */}
              <div className="table-container desktop-only">
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

              {/* Mobile / Tablet Adaptive Card List */}
              <div className="mobile-card-list">
                {workQueue.slice(0, 5).map(item => (
                  <div key={item.case_id} className="mobile-item-card">
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <span className="mobile-score-badge">{item.priority_score}</span>
                        <div>
                          <div className="mobile-card-acc">{item.account_number}</div>
                          <div className="mobile-card-debtor">{item.customer_name || "Debtor Record"}</div>
                        </div>
                      </div>
                      <span className={`status-pill status-${item.case_status.toLowerCase()}`}>{item.case_status}</span>
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-stat">
                        <label>Arrears</label>
                        <span className="arrears-val">{money(item.arrears)}</span>
                      </div>
                      <div className="mobile-stat">
                        <label>DPD (Aging)</label>
                        <span>{item.days_in_arrears} Days</span>
                      </div>
                      <div className="mobile-stat" style={{ gridColumn: "span 2" }}>
                        <label>Strategy / Next Action</label>
                        <span style={{ color: "#38bdf8", fontWeight: 500 }}>{item.next_action}</span>
                      </div>
                    </div>

                    <div className="mobile-card-actions">
                      <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => openAccountWorkbench(item.account_id)}>
                        🚀 Work Case 360°
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "workqueue" && (() => {
          const filteredWorkQueue = workQueue.filter(item => {
            const matchesSearch = !wqSearch || 
              (item.account_number && item.account_number.toLowerCase().includes(wqSearch.toLowerCase())) ||
              (item.customer_name && item.customer_name.toLowerCase().includes(wqSearch.toLowerCase())) ||
              (item.mobile && item.mobile.includes(wqSearch));
            
            const matchesStatus = wqStatusFilter === "ALL" || item.case_status === wqStatusFilter;
            const matchesStrategy = wqStrategyFilter === "ALL" || item.strategy_code === wqStrategyFilter;

            return matchesSearch && matchesStatus && matchesStrategy;
          });

          return (
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: "wrap", gap: "16px" }}>
                <div className="panel-title">
                  <h3>Collector Daily Work Queue ({filteredWorkQueue.length} / {workQueue.length} Accounts)</h3>
                  <p>Prioritized work order based on DPD, Arrears, PTP, and Broken Promises</p>
                </div>
              </div>

              {/* Work Queue Filter Toolbar */}
              <div className="filter-toolbar">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="🔍 Search account, debtor, or mobile..."
                    value={wqSearch}
                    onChange={e => setWqSearch(e.target.value)}
                    className="form-input"
                  />
                  {wqSearch && (
                    <button className="clear-search-btn" onClick={() => setWqSearch("")}>✕</button>
                  )}
                </div>

                <div className="filter-selects">
                  <select
                    value={wqStatusFilter}
                    onChange={e => setWqStatusFilter(e.target.value)}
                    className="form-select filter-select"
                  >
                    <option value="ALL">All Case Statuses</option>
                    <option value="NEW">NEW</option>
                    <option value="ENGAGED">ENGAGED</option>
                    <option value="PROMISE_MADE">PROMISE_MADE</option>
                    <option value="ARRANGEMENT_ACTIVE">ARRANGEMENT_ACTIVE</option>
                    <option value="ESCALATED">ESCALATED</option>
                  </select>

                  <select
                    value={wqStrategyFilter}
                    onChange={e => setWqStrategyFilter(e.target.value)}
                    className="form-select filter-select"
                  >
                    <option value="ALL">All Strategies</option>
                    <option value="INTENSIVE_RECOVERY">INTENSIVE_RECOVERY</option>
                    <option value="ACTIVE_RECOVERY">ACTIVE_RECOVERY</option>
                    <option value="STANDARD_RECOVERY">STANDARD_RECOVERY</option>
                    <option value="LIGHT_TOUCH">LIGHT_TOUCH</option>
                  </select>

                  {(wqSearch || wqStatusFilter !== "ALL" || wqStrategyFilter !== "ALL") && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setWqSearch("");
                        setWqStatusFilter("ALL");
                        setWqStrategyFilter("ALL");
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {filteredWorkQueue.length === 0 ? (
                <div className="empty-filter-state">
                  <p>No collection cases match the current filter criteria.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="table-container desktop-only">
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
                        {filteredWorkQueue.map(item => (
                          <tr key={item.case_id}>
                            <td><strong style={{ color: "#818cf8", fontSize: "15px" }}>{item.priority_score}</strong></td>
                            <td><strong>{item.account_number}</strong></td>
                            <td>{item.customer_name ?? "—"}</td>
                            <td>{formatPhone(item.mobile)}</td>
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

                  {/* Mobile / Tablet Adaptive Card List */}
                  <div className="mobile-card-list">
                    {filteredWorkQueue.map(item => (
                      <div key={item.case_id} className="mobile-item-card">
                        <div className="mobile-card-header">
                          <div className="mobile-card-title-group">
                            <span className="mobile-score-badge">{item.priority_score}</span>
                            <div>
                              <div className="mobile-card-acc">{item.account_number}</div>
                              <div className="mobile-card-debtor">{item.customer_name || "Debtor Record"}</div>
                            </div>
                          </div>
                          <span className={`status-pill status-${item.case_status.toLowerCase()}`}>{item.case_status}</span>
                        </div>

                        <div className="mobile-card-body">
                          <div className="mobile-stat">
                            <label>Arrears</label>
                            <span className="arrears-val">{money(item.arrears)}</span>
                          </div>
                          <div className="mobile-stat">
                            <label>DPD / Mobile</label>
                            <span>{item.days_in_arrears} DPD • {formatPhone(item.mobile)}</span>
                          </div>
                          <div className="mobile-stat" style={{ gridColumn: "span 2" }}>
                            <label>Recommended Collector Action</label>
                            <span style={{ color: "#38bdf8", fontWeight: 500 }}>{item.next_action}</span>
                          </div>
                        </div>

                        <div className="mobile-card-actions">
                          <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => openAccountWorkbench(item.account_id)}>
                            🎯 Work Debtor Case
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {view === "accounts" && (() => {
          const filteredAccounts = accounts.filter(acc => {
            const matchesSearch = !accSearch ||
              (acc.account_number && acc.account_number.toLowerCase().includes(accSearch.toLowerCase()));
            
            const matchesStatus = accStatusFilter === "ALL" || acc.account_status === accStatusFilter;
            const matchesMinArrears = !accMinArrears || Number(acc.arrears) >= Number(accMinArrears);

            return matchesSearch && matchesStatus && matchesMinArrears;
          });

          return (
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: "wrap", gap: "16px" }}>
                <div className="panel-title">
                  <h3>Municipal Debt Book ({filteredAccounts.length} / {accounts.length} Accounts)</h3>
                  <p>Complete debtor ledger with balance, arrears, and collection statuses</p>
                </div>
              </div>

              {/* Debt Book Filter Toolbar */}
              <div className="filter-toolbar">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="🔍 Search account number..."
                    value={accSearch}
                    onChange={e => setAccSearch(e.target.value)}
                    className="form-input"
                  />
                  {accSearch && (
                    <button className="clear-search-btn" onClick={() => setAccSearch("")}>✕</button>
                  )}
                </div>

                <div className="filter-selects">
                  <select
                    value={accStatusFilter}
                    onChange={e => setAccStatusFilter(e.target.value)}
                    className="form-select filter-select"
                  >
                    <option value="ALL">All Account Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DELINQUENT">DELINQUENT</option>
                    <option value="DEFAULT">DEFAULT</option>
                    <option value="PAID">PAID</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Min Arrears (R)"
                    value={accMinArrears}
                    onChange={e => setAccMinArrears(e.target.value)}
                    className="form-input filter-input"
                    style={{ width: "140px" }}
                  />

                  {(accSearch || accStatusFilter !== "ALL" || accMinArrears) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAccSearch("");
                        setAccStatusFilter("ALL");
                        setAccMinArrears("");
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {filteredAccounts.length === 0 ? (
                <div className="empty-filter-state">
                  <p>No municipal accounts match the current filter criteria.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="table-container desktop-only">
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
                        {filteredAccounts.map(acc => (
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

                  {/* Mobile / Tablet Adaptive Card List */}
                  <div className="mobile-card-list">
                    {filteredAccounts.map(acc => (
                      <div key={acc.id} className="mobile-item-card">
                        <div className="mobile-card-header">
                          <div>
                            <div className="mobile-card-acc">{acc.account_number}</div>
                            <div className="mobile-card-debtor">Status: {acc.account_status}</div>
                          </div>
                          <span className="status-pill status-new">{acc.account_status}</span>
                        </div>

                        <div className="mobile-card-body">
                          <div className="mobile-stat">
                            <label>Total Balance</label>
                            <span>{money(acc.balance)}</span>
                          </div>
                          <div className="mobile-stat">
                            <label>Arrears</label>
                            <span className="arrears-val">{money(acc.arrears)}</span>
                          </div>
                          <div className="mobile-stat">
                            <label>Aging</label>
                            <span>{acc.days_in_arrears} Days</span>
                          </div>
                          <div className="mobile-stat">
                            <label>Last Payment</label>
                            <span>{acc.last_payment_date ? money(acc.last_payment_amount) : "None"}</span>
                          </div>
                        </div>

                        <div className="mobile-card-actions">
                          <button className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => openAccountWorkbench(acc.id)}>
                            📑 View Account 360°
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {view === "imports" && (
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>📊 Municipal Account Import & Column Mapping Wizard</h3>
                <p>Safe ingestion with automated column header detection, alias matching, row preview, and audit tracking</p>
              </div>
            </div>

            {/* Step Wizard Header */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
              <button
                className={`btn btn-sm ${importStage === "upload" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setImportStage("upload")}
              >
                1. Select File
              </button>
              <button
                className={`btn btn-sm ${importStage === "mapping" ? "btn-primary" : "btn-secondary"}`}
                disabled={!importMappingData}
                onClick={() => setImportStage("mapping")}
              >
                2. Column Mapping
              </button>
              <button
                className={`btn btn-sm ${importStage === "preview" ? "btn-primary" : "btn-secondary"}`}
                disabled={!importMappingData}
                onClick={() => setImportStage("preview")}
              >
                3. Data Preview ({importMappingData?.total_rows || 0} rows)
              </button>
              {importResult && (
                <button
                  className={`btn btn-sm ${importStage === "result" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setImportStage("result")}
                >
                  4. Ingestion Results
                </button>
              )}
            </div>

            {/* Stage 1: Upload */}
            {importStage === "upload" && (
              <div style={{ maxWidth: "680px", padding: "10px 0" }}>
                <div style={{ padding: "32px", border: "2px dashed rgba(255,255,255,0.15)", borderRadius: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)", marginBottom: "20px" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📁</div>
                  <h4 style={{ marginBottom: "8px" }}>Upload Municipal Debt Book</h4>
                  <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>
                    Select a <strong>.CSV</strong> or <strong>.XLSX</strong> file containing municipal accounts, balances, and contact details.
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f) handleInspectFile(f);
                    }}
                    className="form-input"
                    style={{ maxWidth: "400px", margin: "0 auto 16px auto" }}
                  />
                  {file && (
                    <div style={{ fontSize: "12px", color: "#38bdf8" }}>
                      Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleInspectFile()}
                    disabled={!file || loading}
                  >
                    {loading ? "Inspecting File..." : "🔍 Inspect & Map Columns ➔"}
                  </button>
                </div>
              </div>
            )}

            {/* Stage 2: Column Mapping */}
            {importStage === "mapping" && importMappingData && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Column Header Verification</h4>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0 0" }}>
                      File: <strong>{importMappingData.filename}</strong> • Total Rows: <strong>{importMappingData.total_rows}</strong>
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setImportStage("upload")}>
                      ⬅ Back
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setImportStage("preview")}>
                      Proceed to Preview ➔
                    </button>
                  </div>
                </div>

                {importMappingData.missing_required && importMappingData.missing_required.length > 0 ? (
                  <div style={{ padding: "14px 18px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "8px", color: "#fca5a5", marginBottom: "20px" }}>
                    ⚠️ Missing mandatory columns: <strong>{importMappingData.missing_required.join(", ")}</strong>. Please verify your file headers.
                  </div>
                ) : (
                  <div style={{ padding: "12px 16px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.4)", borderRadius: "8px", color: "#86efac", marginBottom: "20px" }}>
                    ✅ All required system fields mapped successfully!
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px" }}>System Field</th>
                        <th style={{ padding: "10px 14px" }}>Requirement</th>
                        <th style={{ padding: "10px 14px" }}>Mapped File Header</th>
                        <th style={{ padding: "10px 14px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: "account_number", label: "Account Number", required: true },
                        { key: "account_status", label: "Account Status", required: false },
                        { key: "balance", label: "Balance (ZAR)", required: false },
                        { key: "arrears", label: "Arrears Amount (ZAR)", required: false },
                        { key: "days_in_arrears", label: "Days in Arrears", required: false },
                        { key: "first_name", label: "Customer First Name", required: false },
                        { key: "last_name", label: "Customer Last Name", required: false },
                        { key: "id_number", label: "SA ID Number", required: false },
                        { key: "mobile", label: "Mobile Number", required: false },
                        { key: "email", label: "Email Address", required: false },
                        { key: "property_reference", label: "Property Ref / Stand No", required: false },
                        { key: "address", label: "Street Address", required: false },
                        { key: "last_payment_date", label: "Last Payment Date", required: false },
                        { key: "last_payment_amount", label: "Last Payment Amount", required: false },
                      ].map(field => {
                        const mappedCol = customColumnMapping[field.key] || importMappingData.mapping[field.key];
                        return (
                          <tr key={field.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{field.label} <span style={{ color: "#64748b", fontSize: "11px" }}>({field.key})</span></td>
                            <td style={{ padding: "10px 14px" }}>
                              {field.required ? (
                                <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.2)", color: "#f87171", fontSize: "11px", fontWeight: 600 }}>MANDATORY</span>
                              ) : (
                                <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(148, 163, 184, 0.1)", color: "#94a3b8", fontSize: "11px" }}>OPTIONAL</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <select
                                className="form-input"
                                style={{ padding: "4px 8px", fontSize: "12px" }}
                                value={mappedCol || ""}
                                onChange={e => {
                                  setCustomColumnMapping({
                                    ...customColumnMapping,
                                    [field.key]: e.target.value,
                                  });
                                }}
                              >
                                <option value="">-- Not Mapped --</option>
                                {importMappingData.columns.map((c: string) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {mappedCol ? (
                                <span style={{ color: "#34d399", fontWeight: 600 }}>✓ Mapped to "{mappedCol}"</span>
                              ) : field.required ? (
                                <span style={{ color: "#f87171", fontWeight: 600 }}>✗ Missing Required</span>
                              ) : (
                                <span style={{ color: "#64748b" }}>— Skipped</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Extra / Unmapped columns section */}
                {(() => {
                  const mappedValues = new Set(Object.values(customColumnMapping || importMappingData.mapping || {}));
                  const unmappedCols = (importMappingData.columns || []).filter((c: string) => !mappedValues.has(c));
                  if (unmappedCols.length === 0) return null;
                  return (
                    <div style={{ marginTop: "20px", padding: "14px 18px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "16px" }}>📦</span>
                        <strong style={{ color: "#38bdf8", fontSize: "13px" }}>Extra Custom Attributes Detected ({unmappedCols.length})</strong>
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 10px 0" }}>
                        The following columns are not mapped to standard core fields and will be automatically captured into the account's flexible <code>metadata</code> JSON bucket:
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {unmappedCols.map((c: string) => (
                          <span key={c} style={{ padding: "3px 8px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: "11px", fontFamily: "monospace" }}>
                            + {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Stage 3: Data Preview */}
            {importStage === "preview" && importMappingData && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h4 style={{ margin: 0 }}>First 10 Rows Data Preview</h4>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0 0" }}>
                      Inspecting {importMappingData.preview_rows?.length || 0} sample rows from {importMappingData.total_rows} total rows
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setImportStage("mapping")}>
                      ⬅ Edit Mapping
                    </button>
                    <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
                      {loading ? "Ingesting Data..." : "🚀 Confirm & Ingest Debt Book"}
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: "auto", maxHeight: "400px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.1)", position: "sticky", top: 0 }}>
                        <th style={{ padding: "8px 12px" }}>#</th>
                        {importMappingData.columns.map((c: string) => (
                          <th key={c} style={{ padding: "8px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(importMappingData.preview_rows || []).map((r: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "8px 12px", color: "#64748b" }}>{idx + 1}</td>
                          {importMappingData.columns.map((c: string) => (
                            <td key={c} style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r[c] !== undefined ? String(r[c]) : ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" onClick={handleImport} disabled={loading} style={{ padding: "10px 24px" }}>
                    {loading ? "Ingesting Data..." : `🚀 Ingest ${importMappingData.total_rows} Accounts into Database`}
                  </button>
                </div>
              </div>
            )}

            {/* Stage 4: Results */}
            {importStage === "result" && importResult && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Ingestion Completed</h4>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0 0" }}>
                      Batch processed with audit event ID recorded
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setFile(null); setImportMappingData(null); setImportResult(null); setImportStage("upload"); }}>
                    Upload Another File
                  </button>
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">Summary Statistics</div>
                  <div className="info-grid">
                    <div className="info-item"><label>Total Rows</label><span className="info-value">{importResult.total_rows}</span></div>
                    <div className="info-item"><label>Created Accounts</label><span className="info-value" style={{ color: "#34d399", fontWeight: 700 }}>{importResult.created}</span></div>
                    <div className="info-item"><label>Updated Accounts</label><span className="info-value" style={{ color: "#38bdf8", fontWeight: 700 }}>{importResult.updated}</span></div>
                    <div className="info-item"><label>Skipped / Errors</label><span className="info-value" style={{ color: "#fb7185", fontWeight: 700 }}>{importResult.skipped}</span></div>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <h5 style={{ color: "#f87171", marginBottom: "12px" }}>⚠️ Detailed Error Log ({importResult.errors.length} issues)</h5>
                    <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", background: "rgba(239,68,68,0.05)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: "rgba(239,68,68,0.1)", textAlign: "left" }}>
                            <th style={{ padding: "8px 12px" }}>Row</th>
                            <th style={{ padding: "8px 12px" }}>Account Number</th>
                            <th style={{ padding: "8px 12px" }}>Error Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.map((err: any, i: number) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <td style={{ padding: "8px 12px", color: "#fca5a5" }}>{err.row}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 600 }}>{err.account_number || "—"}</td>
                              <td style={{ padding: "8px 12px", color: "#fca5a5" }}>{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === "users" && currentUser?.role !== "COLLECTOR" && (
          <div>
            {/* Onboard New Municipality Card - Restricted to SUPERADMIN */}
            {currentUser?.role === "SUPERADMIN" && (
              <div className="glass-panel" style={{ marginBottom: "28px" }}>
                <div className="panel-header">
                  <div className="panel-title">
                    <h3>🏛️ Onboard New Municipality (Tenant)</h3>
                    <p>Register a new South African municipality or institutional debt portfolio</p>
                  </div>
                </div>

                <form onSubmit={handleCreateTenant} style={{ maxWidth: "800px" }}>
                  <div className="info-grid" style={{ marginBottom: "16px" }}>
                    <div className="form-group">
                      <label>Municipality / Tenant Name</label>
                      <input
                        type="text"
                        placeholder="e.g. City of Johannesburg Metropolitan Municipality"
                        value={newTenantName}
                        onChange={e => setNewTenantName(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Municipal Code (Unique)</label>
                      <input
                        type="text"
                        placeholder="e.g. JHB, EKU, TSH"
                        value={newTenantCode}
                        onChange={e => setNewTenantCode(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={loading || !newTenantName || !newTenantCode}>
                    {loading ? "Registering..." : "🏛️ Onboard Municipality"}
                  </button>
                </form>
              </div>
            )}

            {/* Create User Card - Restricted to ADMIN and SUPERADMIN */}
            {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
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
                        style={{
                          background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
                          borderColor: "#3b82f6",
                          color: "#ffffff",
                          fontWeight: 600,
                          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                        }}
                      >
                        <option value="SUPERADMIN" style={{ background: "#0f172a", color: "#ffffff" }}>👑 SUPERADMIN (Global System Oversight)</option>
                        <option value="ADMIN" style={{ background: "#0f172a", color: "#ffffff" }}>🏛️ ADMIN (Municipality Administrator)</option>
                        <option value="COLLECTOR" style={{ background: "#0f172a", color: "#ffffff" }}>🎯 COLLECTOR (Work Queue & Debtor Engagement)</option>
                        <option value="AUDITOR" style={{ background: "#0f172a", color: "#ffffff" }}>📑 AUDITOR (Read-Only Financial Logs)</option>
                      </select>
                    </div>
                  </div>

                  {newRole !== "SUPERADMIN" && (
                    <div className="form-group" style={{ marginBottom: "20px" }}>
                      <label>Assign to Municipalities (Multi-Select)</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {tenants.map(t => {
                          const isChecked = newTenantIds.includes(t.id);
                          return (
                            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setNewTenantIds([...newTenantIds, t.id]);
                                  } else {
                                    setNewTenantIds(newTenantIds.filter(id => id !== t.id));
                                  }
                                }}
                                style={{ width: "16px", height: "16px" }}
                              />
                              <span>{t.name} ({t.code})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Creating User..." : "➕ Create User Account"}
                  </button>
                </form>
              </div>
            )}

            {/* Users Table / Mobile Cards */}
            <div className="glass-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Active System Users ({usersList.length})</h3>
                  <p>All authenticated personnel with active role access</p>
                </div>
              </div>

              {/* Desktop Users Table */}
              <div className="table-container desktop-only">
                <table>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Municipality Scope</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
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
                          {(() => {
                            const userAssigned = u.tenant_ids && u.tenant_ids.length > 0
                              ? u.tenant_ids
                              : (u.tenant_id ? [u.tenant_id] : []);
                            if (userAssigned.length === 0) {
                              return <span style={{ color: "#94a3b8" }}>🌐 Global All Municipalities</span>;
                            }
                            return (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {userAssigned.map((tid: string) => {
                                  const t = tenants.find(item => item.id === tid);
                                  return (
                                    <span
                                      key={tid}
                                      style={{
                                        padding: "2px 8px",
                                        borderRadius: "4px",
                                        background: "rgba(56, 189, 248, 0.15)",
                                        border: "1px solid rgba(56, 189, 248, 0.3)",
                                        color: "#38bdf8",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                      }}
                                    >
                                      🏛️ {t ? `${t.name} (${t.code})` : "Municipality"}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <span className={`status-pill ${u.is_active !== false ? "status-paying" : "status-broken"}`}>
                            {u.is_active !== false ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td style={{ color: "#94a3b8" }}>{u.created_at?.split("T")[0]}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "12px" }}
                            onClick={() => openEditUser(u)}
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Adaptive User Cards */}
              <div className="mobile-card-list">
                {usersList.map(u => (
                  <div key={u.id} className="mobile-item-card">
                    <div className="mobile-card-header">
                      <div>
                        <div className="mobile-card-acc">{u.full_name}</div>
                        <div className="mobile-card-debtor" style={{ color: "#38bdf8" }}>{u.email}</div>
                      </div>
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
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-stat" style={{ gridColumn: "span 2" }}>
                        <label>Assigned Municipalities</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                          {(() => {
                            const userAssigned = u.tenant_ids && u.tenant_ids.length > 0
                              ? u.tenant_ids
                              : (u.tenant_id ? [u.tenant_id] : []);
                            if (userAssigned.length === 0) {
                              return <span style={{ color: "#94a3b8" }}>🌐 Global All Municipalities</span>;
                            }
                            return userAssigned.map((tid: string) => {
                              const t = tenants.find(item => item.id === tid);
                              return (
                                <span key={tid} style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontSize: "11px" }}>
                                  {t ? t.code : "MUNI"}
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <div className="mobile-stat">
                        <label>Account Status</label>
                        <span style={{ color: u.is_active !== false ? "#34d399" : "#fb7185", fontWeight: 600 }}>
                          {u.is_active !== false ? "Active" : "Deactivated"}
                        </span>
                      </div>
                      <div className="mobile-stat">
                        <label>Created On</label>
                        <span>{u.created_at?.split("T")[0]}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => openEditUser(u)}
                      >
                        ✏️ Edit User Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS VIEW - Available to ALL users */}
        {view === "settings" && currentUser && (
          <div className="glass-panel" style={{ maxWidth: "800px" }}>
            <div className="panel-header">
              <div className="panel-title">
                <h3>⚙️ Personal Account & Security Settings</h3>
                <p>Manage your account credentials, display name, and password</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings}>
              <div className="info-grid" style={{ marginBottom: "20px" }}>
                <div className="form-group">
                  <label>Your Full Name</label>
                  <input
                    type="text"
                    value={settingsFullName}
                    onChange={e => setSettingsFullName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Your Work Email Address</label>
                  <input
                    type="email"
                    value={settingsEmail}
                    onChange={e => setSettingsEmail(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div style={{ padding: "16px 20px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#f8fafc" }}>Change Security Password</h4>
                <p style={{ color: "#94a3b8", fontSize: "12.5px", margin: "0 0 16px 0" }}>
                  Leave blank if you do not wish to change your current password.
                </p>

                <div className="info-grid">
                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={settingsPassword}
                      onChange={e => setSettingsPassword(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={settingsConfirmPassword}
                      onChange={e => setSettingsConfirmPassword(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12.5px", color: "#94a3b8" }}>
                  Assigned Role: <strong style={{ color: "#38bdf8" }}>{currentUser.role}</strong>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: "10px 24px" }}>
                  {loading ? "Saving Changes..." : "💾 Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* EDIT USER MODAL (ADMIN & SUPERADMIN) */}
      {editingUser && (
        <div className="modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "600px", width: "92%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "18px" }}>
              <div className="panel-title">
                <h3>✏️ Edit User & Municipality Scope</h3>
                <p>Modify user details, role permissions, and assigned municipalities</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={e => setEditFullName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="form-select"
                  style={{
                    background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
                    borderColor: "#3b82f6",
                    color: "#ffffff",
                    fontWeight: 600,
                  }}
                  disabled={currentUser?.role === "ADMIN" && editingUser.role === "SUPERADMIN"}
                >
                  <option value="SUPERADMIN" style={{ background: "#0f172a", color: "#ffffff" }}>👑 SUPERADMIN (Global)</option>
                  <option value="ADMIN" style={{ background: "#0f172a", color: "#ffffff" }}>🏛️ ADMIN</option>
                  <option value="COLLECTOR" style={{ background: "#0f172a", color: "#ffffff" }}>🎯 COLLECTOR</option>
                  <option value="AUDITOR" style={{ background: "#0f172a", color: "#ffffff" }}>📑 AUDITOR</option>
                </select>
              </div>

              {editRole !== "SUPERADMIN" && (
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label>Assigned Municipalities (Multi-Select)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {tenants.map(t => {
                      const isChecked = editTenantIds.includes(t.id);
                      return (
                        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setEditTenantIds([...editTenantIds, t.id]);
                              } else {
                                setEditTenantIds(editTenantIds.filter(id => id !== t.id));
                              }
                            }}
                            style={{ width: "16px", height: "16px" }}
                          />
                          <span>{t.name} ({t.code})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Reset Password (optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={e => setEditIsActive(e.target.checked)}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span>User Account Active (Uncheck to suspend/deactivate login access)</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Saving..." : "💾 Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <span className="info-value" style={{ color: "#38bdf8" }}>{formatPhone(account360.customer?.mobile)}</span>
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

function formatPhone(val: any) {
  if (!val) return "—";
  const str = String(val).trim();
  const digits = str.replace(/\D/g, "");
  if (digits.length === 9 && ["6", "7", "8", "9"].includes(digits[0])) {
    return `0${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("27")) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return digits;
  }
  return str;
}

createRoot(document.getElementById("root")!).render(<App />);

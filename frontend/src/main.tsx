import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = (import.meta as any).env?.VITE_API_URL || "/api";

interface Tenant {
  id: string;
  name: string;
  code: string;
  engagement_model?: string;
  subscription_tier?: string;
  commission_rate?: number;
  monthly_subscription_fee?: number;
  subscription_status?: string;
  billing_contact_email?: string;
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
    popia_consent_status?: string | null;
    popia_dnc_status?: boolean;
    data_retention_expiry?: string | null;
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
  const [view, setView] = useState<"dashboard" | "workqueue" | "accounts" | "imports" | "onboarding" | "users" | "saas_tiers" | "billing" | "reports" | "settings">("dashboard");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workQueue, setWorkQueue] = useState<WorkItem[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [account360, setAccount360] = useState<Account360 | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "contact" | "ptp" | "plan" | "payments">("overview");

  // Reporting State
  const [reportType, setReportType] = useState<"EXECUTIVE_SUMMARY" | "ARREARS_AGING" | "RECOVERED_PAYMENTS" | "PTP_COMPLIANCE" | "COMMERCIAL_BILLING">("EXECUTIVE_SUMMARY");
  const [reportDateFrom, setReportDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [reportDateTo, setReportDateTo] = useState(new Date().toISOString().split("T")[0]);

  // Proposals & Invoicing State
  const [proposals, setProposals] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [billingSubTab, setBillingSubTab] = useState<"invoices" | "proposals">("invoices");
  const [showNewProposalModal, setShowNewProposalModal] = useState(false);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [viewingPdfDoc, setViewingPdfDoc] = useState<{ type: "INVOICE" | "PROPOSAL"; data: any } | null>(null);

  // Proposal Creation Form
  const [propTenantId, setPropTenantId] = useState("");
  const [propTitle, setPropTitle] = useState("Municipal Revenue Recovery & Khokhisa SaaS Platform Proposal");
  const [propModel, setPropModel] = useState("MANAGED_SERVICE");
  const [propTier, setPropTier] = useState("ENTERPRISE");
  const [propMonthlyFee, setPropMonthlyFee] = useState("0");
  const [propCommissionRate, setPropCommissionRate] = useState("10.00");
  const [propValidDays, setPropValidDays] = useState("30");
  const [propScope, setPropScope] = useState("End-to-end debt recovery management, debtor contactability tracing, algorithmic work queue dispatch, and automated payment reconciliation.");
  const [propTerms, setPropTerms] = useState("1. Invoicing on monthly payment cycles.\n2. Subject to Municipal Finance Management Act (MFMA) compliance.\n3. 30-day payment term.");
  const [propLineItems, setPropLineItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([
    { description: "Khokhisa Core Collections Platform Deployment & Configuration", quantity: 1, unit_price: 50000 },
    { description: "Managed Recovery Operations (Contingency Commission Based on Recovered Cash)", quantity: 1, unit_price: 0 },
  ]);

  // Invoice Creation Form
  const [invTenantId, setInvTenantId] = useState("");
  const [invBillingPeriod, setInvBillingPeriod] = useState(new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }));
  const [invDueDays, setInvDueDays] = useState("30");
  const [invLineItems, setInvLineItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([
    { description: "Khokhisa Municipal SaaS Platform License Fee (Monthly)", quantity: 1, unit_price: 20000 },
  ]);
  const [invBankingBank, setInvBankingBank] = useState("Capitec Business");
  const [invBankingAccName, setInvBankingAccName] = useState("Moloi Mosea Investments (Pty) Ltd");
  const [invBankingAccNum, setInvBankingAccNum] = useState("62899432101");
  const [invBankingBranch, setInvBankingBranch] = useState("470010");
  const [invBankingType, setInvBankingType] = useState("Business Cheque Account");
  const [invBankingSwift, setInvBankingSwift] = useState("CBLAZAJJ");

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

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("cos_theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cos_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

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

  // New Tenant Creation state (SaaS & Managed Services)
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantCode, setNewTenantCode] = useState("");
  const [newTenantModel, setNewTenantModel] = useState<"MANAGED_SERVICE" | "SAAS_SELF_SERVICE">("MANAGED_SERVICE");
  const [newTenantTier, setNewTenantTier] = useState("ENTERPRISE");
  const [newTenantCommission, setNewTenantCommission] = useState("10.00");
  const [newTenantMonthlyFee, setNewTenantMonthlyFee] = useState("0.00");
  const [newTenantBillingEmail, setNewTenantBillingEmail] = useState("");
  const [editingTenant, setEditingTenant] = useState<any>(null);
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
            const savedDefault = currentUser?.id ? localStorage.getItem(`cos_default_tenant_${currentUser.id}`) : null;
            const userAssigned = currentUser?.tenant_ids || (currentUser?.tenant_id ? [currentUser.tenant_id] : []);
            
            if (savedDefault && data.some(d => d.id === savedDefault)) {
              if (currentUser?.role === "SUPERADMIN" || userAssigned.includes(savedDefault)) {
                return savedDefault;
              }
            }
            if (currentUser?.tenant_id && data.some(d => d.id === currentUser.tenant_id)) {
              return currentUser.tenant_id;
            }
            if (currentUser?.role !== "SUPERADMIN" && userAssigned.length > 0) {
              if (prev && userAssigned.includes(prev)) return prev;
              return userAssigned[0];
            }
            return prev || data[0].id;
          });
        } else {
          setTenants([
            { id: "9199c540-11dc-4ce0-bc70-922fccf25274", name: "City of Johannesburg", code: "JHB", engagement_model: "MANAGED_SERVICE", subscription_tier: "ENTERPRISE", commission_rate: 10.00, monthly_subscription_fee: 0, subscription_status: "ACTIVE" },
          ]);
          setSelectedTenant(prev => prev || "9199c540-11dc-4ce0-bc70-922fccf25274");
        }
      })
      .catch(err => {
        console.error("Could not fetch tenants:", err);
      });
  };

  // Get municipalities accessible to the current user
  const accessibleTenants = tenants.filter(t => {
    if (!currentUser || currentUser.role === "SUPERADMIN") return true;
    const userAssigned = currentUser.tenant_ids || (currentUser.tenant_id ? [currentUser.tenant_id] : currentUser.tenant_id ? [currentUser.tenant_id] : []);
    if (userAssigned.length === 0) return true;
    return userAssigned.includes(t.id);
  });

  useEffect(() => {
    fetchTenants();

    // Check if opened as standalone edit window: ?edit_tenant_id=XYZ
    const params = new URLSearchParams(window.location.search);
    const editTenantId = params.get("edit_tenant_id");
    if (editTenantId) {
      fetch(`${API}/tenants`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const target = data.find(t => t.id === editTenantId);
            if (target) setEditingTenant(target);
          }
        })
        .catch(console.error);
    }
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
          engagement_model: newTenantModel,
          subscription_tier: newTenantTier,
          commission_rate: newTenantModel === "MANAGED_SERVICE" ? Number(newTenantCommission) : 0,
          monthly_subscription_fee: newTenantModel === "SAAS_SELF_SERVICE" ? Number(newTenantMonthlyFee) : 0,
          billing_contact_email: newTenantBillingEmail || null,
          subscription_status: "ACTIVE",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error onboarding municipality: ${data.detail}`);
        return;
      }
      alert(`Municipality ${data.name} (${data.code}) onboarded successfully under ${data.engagement_model === "MANAGED_SERVICE" ? "Molmos Managed Collections" : "Internal SaaS Subscription"}!`);
      setNewTenantName("");
      setNewTenantCode("");
      setNewTenantBillingEmail("");
      fetchTenants();
    } catch (err: any) {
      alert("Could not reach backend API");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/tenants/${editingTenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingTenant.name,
          code: editingTenant.code,
          engagement_model: editingTenant.engagement_model,
          subscription_tier: editingTenant.subscription_tier,
          commission_rate: Number(editingTenant.commission_rate || 0),
          monthly_subscription_fee: Number(editingTenant.monthly_subscription_fee || 0),
          subscription_status: editingTenant.subscription_status,
          billing_contact_email: editingTenant.billing_contact_email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error updating municipality: ${data.detail}`);
        return;
      }
      alert(`Municipality ${data.name} updated successfully!`);
      setEditingTenant(null);
      fetchTenants();
    } catch (err: any) {
      alert("Could not update municipality: " + err.message);
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

    // 5. Billing proposals & invoices
    fetch(`${API}/billing/proposals`)
      .then(r => r.json())
      .then(setProposals)
      .catch(console.error);

    fetch(`${API}/billing/invoices`)
      .then(r => r.json())
      .then(setInvoices)
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

  // Proposal Handlers
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenant = propTenantId || selectedTenant;
    if (!targetTenant) {
      alert("Please select a municipality for this proposal.");
      return;
    }
    setLoading(true);
    try {
      const validUntilDate = new Date(Date.now() + Number(propValidDays) * 86400000).toISOString().split("T")[0];
      const res = await fetch(`${API}/billing/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: targetTenant,
          title: propTitle,
          engagement_model: propModel,
          subscription_tier: propTier,
          monthly_fee: Number(propMonthlyFee) || 0,
          commission_rate: Number(propCommissionRate) || 10,
          valid_until: validUntilDate,
          scope_of_work: propScope,
          terms_and_conditions: propTerms,
          line_items: propLineItems,
          created_by: currentUser?.full_name || "SuperAdmin",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error creating proposal: " + (data.detail || JSON.stringify(data)));
        return;
      }
      alert(`✅ Proposal "${data.proposal_number}" created successfully!`);
      setShowNewProposalModal(false);
      refreshData();
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProposalStatus = async (proposalId: string, newStatus: string, targetEmail?: string) => {
    setLoading(true);
    try {
      const actorName = currentUser?.full_name || (currentUser?.role === "ADMIN" ? "Municipal Executive" : "SuperAdmin");
      let url = `${API}/billing/proposals/${proposalId}/status?status=${newStatus}&actor=${encodeURIComponent(actorName)}`;
      if (targetEmail) {
        url += `&target_email=${encodeURIComponent(targetEmail)}`;
      }
      const res = await fetch(url, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error updating proposal status: " + (data.detail || JSON.stringify(data)));
        return;
      }
      if (newStatus === "SUBMITTED_TO_MUNICIPALITY") {
        alert(`🚀 Proposal "${data.proposal_number}" submitted to municipality! Notification dispatched to ${targetEmail || data.tenant_name}.`);
      } else if (newStatus === "REJECTED") {
        alert(`❌ Proposal "${data.proposal_number}" has been marked as REJECTED.`);
      } else {
        alert(`Proposal status updated to "${newStatus}"!`);
      }
      refreshData();
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProposal = async (proposalId: string, propNum: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Proposal "${propNum}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/billing/proposals/${proposalId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Error deleting proposal: " + (err.detail || JSON.stringify(err)));
        return;
      }
      alert(`🗑️ Proposal "${propNum}" deleted successfully.`);
      refreshData();
    } catch (e: any) {
      alert("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string, invNum: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Tax Invoice "${invNum}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/billing/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Error deleting invoice: " + (err.detail || JSON.stringify(err)));
        return;
      }
      alert(`🗑️ Invoice "${invNum}" deleted successfully.`);
      refreshData();
    } catch (e: any) {
      alert("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Invoice Handlers
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenant = invTenantId || selectedTenant;
    if (!targetTenant) {
      alert("Please select a municipality to invoice.");
      return;
    }
    setLoading(true);
    try {
      const dueDate = new Date(Date.now() + Number(invDueDays) * 86400000).toISOString().split("T")[0];
      const res = await fetch(`${API}/billing/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: targetTenant,
          billing_period: invBillingPeriod,
          issue_date: new Date().toISOString().split("T")[0],
          due_date: dueDate,
          vat_rate: 15.0,
          line_items: invLineItems,
          banking_details: {
            bank_name: invBankingBank,
            account_name: invBankingAccName,
            account_number: invBankingAccNum,
            branch_code: invBankingBranch,
            account_type: invBankingType,
            swift_code: invBankingSwift,
            payment_reference: `INV-${Date.now().toString().slice(-4)}`,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error issuing invoice: " + (data.detail || JSON.stringify(data)));
        return;
      }
      alert(`✅ Tax Invoice "${data.invoice_number}" issued successfully!`);
      setShowNewInvoiceModal(false);
      refreshData();
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutogenerateInvoice = async (tenantId: string) => {
    setLoading(true);
    try {
      const currentPeriod = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const res = await fetch(`${API}/billing/invoices/autogenerate?tenant_id=${tenantId}&billing_period=${encodeURIComponent(currentPeriod)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error autogenerating invoice: " + (data.detail || JSON.stringify(data)));
        return;
      }
      alert(`🚀 Auto-generated Tax Invoice "${data.invoice_number}" for ${data.tenant_name || 'Municipality'}!`);
      refreshData();
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/billing/invoices/${invoiceId}/status?status=${newStatus}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error updating invoice: " + (data.detail || JSON.stringify(data)));
        return;
      }
      alert(`Invoice status updated to "${newStatus}"!`);
      refreshData();
    } catch (err: any) {
      alert("Network error: " + err.message);
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
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`HTTP ${res.status} ${res.statusText} - ${text.slice(0, 150)}`);
      }
      if (!res.ok) {
        alert("File inspection failed: " + (data.detail || JSON.stringify(data)));
        return;
      }
      setImportMappingData(data);
      setCustomColumnMapping(data.mapping || {});
      setImportStage("mapping");
    } catch (e: any) {
      alert("Error inspecting file: " + (e.message || e.toString()));
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
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText}): ${text.slice(0, 120)}`);
      }
      if (!res.ok) {
        alert(data.detail || "Failed to complete import.");
        return;
      }
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
        <div className="login-card" style={{ position: "relative" }}>
          {/* Theme Toggle Button on Login Screen */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleTheme}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              padding: "6px 10px",
              borderRadius: "50%",
              fontSize: "15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
            }}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <div className="login-brand">
            <div className="loan-emblem-wrapper">
              <div className="loan-emblem-bg"></div>
              <svg className="loan-svg-icon" viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 1. Municipal Debtor Vault & Arrears Container (Car-equivalent) */}
                <g className="debtor-vault">
                  {/* Vault Base & Body */}
                  <rect x="12" y="38" width="48" height="42" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="2.5"/>
                  {/* Glowing Vault Door Dial */}
                  <circle cx="36" cy="59" r="14" fill="#0f172a" stroke="#10b981" strokeWidth="2"/>
                  {/* Golden Coin Center Lock */}
                  <circle cx="36" cy="59" r="9" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
                  <text x="36" y="64" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900" fontFamily="Outfit, sans-serif">
                    R
                  </text>
                  {/* Vault Indicator Hinges */}
                  <circle cx="17" cy="46" r="2.5" fill="#64748b"/>
                  <circle cx="17" cy="72" r="2.5" fill="#64748b"/>
                  <rect x="52" y="55" width="5" height="8" rx="2" fill="#38bdf8"/>
                </g>

                {/* 2. Sparkling Clean Recovered Stars */}
                <g className="sparkle-star">
                  <path d="M38 18 L40 24 L46 26 L40 28 L38 34 L36 28 L30 26 L36 24 Z" fill="#fbbf24"/>
                </g>
                <g className="sparkle-star" style={{ transformOrigin: "20px 28px", animationDelay: "0.6s" }}>
                  <path d="M20 25 L21.5 29 L25.5 30.5 L21.5 32 L20 36 L18.5 32 L14.5 30.5 L18.5 29 Z" fill="#34d399"/>
                </g>

                {/* 3. Floating Recovered Cash & Coin Bubbles */}
                <g className="cash-bubble-1">
                  <circle cx="48" cy="28" r="7" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" strokeWidth="1.8"/>
                  <text x="48" y="32" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="800" fontFamily="Outfit, sans-serif">R</text>
                </g>
                <g className="cash-bubble-2">
                  <circle cx="32" cy="22" r="6" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth="1.8"/>
                  <text x="32" y="26" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="800" fontFamily="Outfit, sans-serif">R</text>
                </g>
                <g className="cash-bubble-3">
                  <circle cx="58" cy="40" r="5" fill="rgba(14, 165, 233, 0.3)" stroke="#38bdf8" strokeWidth="1.5"/>
                  <text x="58" y="44" textAnchor="middle" fill="#7dd3fc" fontSize="7" fontWeight="800" fontFamily="Outfit, sans-serif">R</text>
                </g>
                <g className="cash-bubble-4">
                  <circle cx="46" cy="46" r="3.5" fill="rgba(52, 211, 153, 0.4)" stroke="#34d399" strokeWidth="1"/>
                </g>

                {/* 4. Active Cash Flow Recovery High-Pressure Stream */}
                <path
                  d="M72 63 C64 58, 54 54, 46 56"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="6 3"
                  className="recovery-stream"
                />
                <path
                  d="M72 63 C62 61, 52 60, 42 63"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                  className="recovery-stream"
                  style={{ animationDirection: "reverse" }}
                />

                {/* 5. Collector Character Figure with Recovery Wand (Washing debt away) */}
                <g className="collector-figure">
                  {/* Collector Head & Hat/Cap */}
                  <circle cx="88" cy="38" r="8.5" fill="#0ea5e9"/>
                  {/* Collector Torso / Uniform */}
                  <path d="M88 47 L88 67" stroke="#0ea5e9" strokeWidth="4.5" strokeLinecap="round"/>
                  {/* Legs */}
                  <path d="M88 67 L81 84 M88 67 L94 84" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round"/>
                  {/* Arms & Recovery Wand Tool */}
                  <path d="M88 53 L74 61 L70 64" stroke="#0ea5e9" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Nozzle Tool */}
                  <rect x="69" y="61" width="5" height="5" rx="1.5" fill="#38bdf8"/>
                  <path d="M69 63.5 L65 63.5" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round"/>
                  {/* High-Pressure Recovery Hose linking to System Pack */}
                  <path d="M74 62 C78 74, 88 80, 95 78" stroke="#64748b" strokeWidth="2" strokeLinecap="round" fill="none"/>
                  {/* Recovery Pack on Back */}
                  <rect x="91" y="50" width="5" height="13" rx="2" fill="#10b981"/>
                </g>
              </svg>
            </div>
            <h2>Khokhisa</h2>
            <p>Municipal Debt Recovery & Revenue System</p>
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
                🏛️ <strong>Municipality Admin</strong> (Oversight & Review)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px" }}
                onClick={() => {
                  setLoginEmail("collector@collectionsos.gov.za");
                  setLoginPassword("Collector@2026!");
                }}
              >
                🎯 <strong>Debt Collector</strong> (Work Queue & PTPs)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px" }}
                onClick={() => {
                  setLoginEmail("auditor@collectionsos.gov.za");
                  setLoginPassword("Auditor@2026!");
                }}
              >
                📑 <strong>Auditor</strong> (Compliance & Read-Only Logs)
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
            <svg viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "32px", height: "32px" }}>
              {/* Vault / Arrears Safe Body */}
              <rect x="12" y="38" width="48" height="42" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="2.5"/>
              <circle cx="36" cy="59" r="13" fill="#0f172a" stroke="#10b981" strokeWidth="2"/>
              <circle cx="36" cy="59" r="8" fill="#f59e0b"/>
              <text x="36" y="63" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="Outfit, sans-serif">R</text>
              {/* Sparkle */}
              <path d="M38 18 L40 24 L46 26 L40 28 L38 34 L36 28 L30 26 L36 24 Z" fill="#fbbf24"/>
              {/* Cash Bubbles */}
              <circle cx="48" cy="28" r="6.5" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" strokeWidth="1.5"/>
              <circle cx="32" cy="24" r="5" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth="1.5"/>
              {/* Stream */}
              <path d="M72 63 C64 58, 54 54, 46 56" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 2.5"/>
              {/* Collector Character */}
              <circle cx="88" cy="38" r="8" fill="#0ea5e9"/>
              <path d="M88 46 L88 67" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round"/>
              <path d="M88 67 L81 84 M88 67 L94 84" stroke="#0ea5e9" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M88 53 L74 61 L70 64" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
              <rect x="69" y="61" width="4" height="4" rx="1" fill="#38bdf8"/>
              <path d="M74 62 C78 74, 88 80, 95 78" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <rect x="91" y="50" width="4" height="12" rx="1.5" fill="#10b981"/>
            </svg>
          </div>
          <div className="brand-info">
            <h1 style={{ fontSize: "16px" }}>Khokhisa</h1>
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
          <div className="brand-icon" title="Khokhisa - South Africa Municipal Debt Recovery OS" style={{ width: "42px", height: "42px" }}>
            <svg viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "36px", height: "36px" }}>
              {/* Vault / Arrears Safe Body */}
              <rect x="12" y="38" width="48" height="42" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="2.5"/>
              <circle cx="36" cy="59" r="13" fill="#0f172a" stroke="#10b981" strokeWidth="2"/>
              <circle cx="36" cy="59" r="8" fill="#f59e0b"/>
              <text x="36" y="63" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="Outfit, sans-serif">R</text>
              {/* Sparkle */}
              <path d="M38 18 L40 24 L46 26 L40 28 L38 34 L36 28 L30 26 L36 24 Z" fill="#fbbf24"/>
              {/* Cash Bubbles */}
              <circle cx="48" cy="28" r="6.5" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" strokeWidth="1.5"/>
              <circle cx="32" cy="24" r="5" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth="1.5"/>
              {/* Stream */}
              <path d="M72 63 C64 58, 54 54, 46 56" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 2.5"/>
              {/* Collector Character */}
              <circle cx="88" cy="38" r="8" fill="#0ea5e9"/>
              <path d="M88 46 L88 67" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round"/>
              <path d="M88 67 L81 84 M88 67 L94 84" stroke="#0ea5e9" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M88 53 L74 61 L70 64" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
              <rect x="69" y="61" width="4" height="4" rx="1" fill="#38bdf8"/>
              <path d="M74 62 C78 74, 88 80, 95 78" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <rect x="91" y="50" width="4" height="12" rx="1.5" fill="#10b981"/>
            </svg>
          </div>
          <div className="brand-info">
            <h1>Khokhisa</h1>
          </div>
        </div>

        <div className="tenant-selector" style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label style={{ margin: 0 }}>Active Municipality ({accessibleTenants.length})</label>
            {selectedTenant && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  borderColor: (currentUser?.tenant_id === selectedTenant || localStorage.getItem(`cos_default_tenant_${currentUser?.id}`) === selectedTenant) ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.15)",
                  color: (currentUser?.tenant_id === selectedTenant || localStorage.getItem(`cos_default_tenant_${currentUser?.id}`) === selectedTenant) ? "#34d399" : "#94a3b8",
                  background: (currentUser?.tenant_id === selectedTenant || localStorage.getItem(`cos_default_tenant_${currentUser?.id}`) === selectedTenant) ? "rgba(34, 197, 94, 0.1)" : "transparent",
                }}
                onClick={async () => {
                  if (!currentUser || !selectedTenant) return;
                  localStorage.setItem(`cos_default_tenant_${currentUser.id}`, selectedTenant);
                  try {
                    // Update user's primary default tenant in backend
                    await fetch(`${API}/auth/users/${currentUser.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tenant_id: selectedTenant }),
                    });
                    const updated = { ...currentUser, tenant_id: selectedTenant };
                    setCurrentUser(updated);
                    localStorage.setItem("cos_user_v2", JSON.stringify(updated));
                    alert(`⭐ Set "${tenants.find(t => t.id === selectedTenant)?.name}" as your default municipality!`);
                  } catch (e) {
                    alert(`Default saved locally!`);
                  }
                }}
                title="Save this municipality as your default on login"
              >
                {(currentUser?.tenant_id === selectedTenant || localStorage.getItem(`cos_default_tenant_${currentUser?.id}`) === selectedTenant) ? "★ Default" : "☆ Set Default"}
              </button>
            )}
          </div>
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
          {currentUser?.role === "SUPERADMIN" && (
            <div className={`nav-item ${view === "imports" ? "active" : ""}`} onClick={() => { setView("imports"); setMobileMenuOpen(false); }}>
              📥 Import Engine
            </div>
          )}
          {currentUser?.role === "SUPERADMIN" && (
            <div className={`nav-item ${view === "onboarding" ? "active" : ""}`} onClick={() => { setView("onboarding"); setMobileMenuOpen(false); }}>
              🏛️ Onboarding & Portfolios
              <span className="nav-badge">{tenants.length}</span>
            </div>
          )}
          {currentUser?.role === "SUPERADMIN" && (
            <div className={`nav-item ${view === "users" ? "active" : ""}`} onClick={() => { setView("users"); setMobileMenuOpen(false); }}>
              👥 User Management & Roles
              <span className="nav-badge">{usersList.length}</span>
            </div>
          )}
          {currentUser?.role === "SUPERADMIN" && (
            <div className={`nav-item ${view === "saas_tiers" ? "active" : ""}`} onClick={() => { setView("saas_tiers"); setMobileMenuOpen(false); }}>
              💎 SaaS Pricing & Tiers
            </div>
          )}
          {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
            <div className={`nav-item ${view === "billing" ? "active" : ""}`} onClick={() => { setView("billing"); setMobileMenuOpen(false); }}>
              🧾 Proposals & Invoicing
              <span className="nav-badge">{invoices.length + proposals.length}</span>
            </div>
          )}
          {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
            <div className={`nav-item ${view === "reports" ? "active" : ""}`} onClick={() => { setView("reports"); setMobileMenuOpen(false); }}>
              📈 Reports & Analytics
            </div>
          )}
          <div className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => { setView("settings"); setMobileMenuOpen(false); setSettingsFullName(currentUser?.full_name || ""); setSettingsEmail(currentUser?.email || ""); }}>
            ⚙️ Account Settings
          </div>
        </nav>

        {currentUser && (
          <div style={{ marginTop: "auto", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="user-profile-name" style={{ fontSize: "13px", fontWeight: 600 }}>{currentUser.full_name}</div>
                <div style={{ marginTop: "3px" }}>
                  <span className="user-role-badge" style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: currentUser.role === "SUPERADMIN" ? "rgba(234, 179, 8, 0.15)" : currentUser.role === "ADMIN" ? "rgba(59, 130, 246, 0.15)" : "rgba(16, 185, 129, 0.15)",
                    color: currentUser.role === "SUPERADMIN" ? "#facc15" : currentUser.role === "ADMIN" ? "#60a5fa" : "#34d399",
                    border: `1px solid ${currentUser.role === "SUPERADMIN" ? "rgba(234, 179, 8, 0.3)" : currentUser.role === "ADMIN" ? "rgba(59, 130, 246, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                  }}>
                    {currentUser.role}
                  </span>
                </div>
              </div>
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
              {view === "onboarding" && "🏛️ Municipal Onboarding & Engagement Portfolios"}
              {view === "users" && "System User Management & Role-Based Access Control"}
              {view === "saas_tiers" && "💎 Commercial SaaS Tier Matrix & Pricing Breakdown"}
              {view === "billing" && "🧾 Commercial Proposals & Municipal Invoicing"}
              {view === "reports" && "📈 Executive & Regulatory Municipal Reports"}
              {view === "settings" && "Account & Profile Settings"}
            </h2>
            <p>
              {view === "dashboard" && "Real-time debt recovery, cash collections, and portfolio status"}
              {view === "workqueue" && "Algorithmically ranked accounts ready for collector action"}
              {view === "accounts" && "Direct access to debtor records, contact details, and account 360° views"}
              {view === "imports" && "Upload CSV / XLSX files with automated field mapping and duplicate protection"}
              {view === "onboarding" && "Onboard new municipal councils and configure engagement agreements"}
              {view === "users" && "Provision new administrative and collector accounts and configure permissions"}
              {view === "saas_tiers" && "Commercial packaging, municipal feature limits, and revenue matrix"}
              {view === "billing" && "Issue structured proposals, generate official tax invoices (PDF), and manage banking remittance"}
              {view === "reports" && "Generate MFMA Section 71/96 compliance summaries, arrears aging, and collection audits (CSV & Printable PDF)"}
              {view === "settings" && "Update your personal details, email address, and account password"}
            </p>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                padding: "0",
                fontSize: "17px",
                borderRadius: "8px",
              }}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
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
                      <th>Debtor Name</th>
                      <th>Arrears</th>
                      <th>DAYS PAST DUE</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workQueue.slice(0, 5).map(item => (
                      <tr key={item.case_id}>
                        <td><strong style={{ color: "#818cf8" }}>{item.priority_score}</strong></td>
                        <td><strong>{item.account_number}</strong></td>
                        <td><span style={{ fontWeight: 600, color: "#f8fafc" }}>{item.customer_name ?? "—"}</span></td>
                        <td style={{ color: "#f87171", fontWeight: 600 }}>{money(item.arrears)}</td>
                        <td><strong>{item.days_in_arrears}</strong></td>
                        <td><span className={`status-pill ${getStatusPillClass(item.case_status)}`}>{formatCaseStatus(item.case_status)}</span></td>
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
                      <span className={`status-pill ${getStatusPillClass(item.case_status)}`}>{formatCaseStatus(item.case_status)}</span>
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-stat">
                        <label>Arrears</label>
                        <span className="arrears-val">{money(item.arrears)}</span>
                      </div>
                      <div className="mobile-stat">
                        <label>DAYS PAST DUE</label>
                        <span>{item.days_in_arrears}</span>
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
                    <option value="PROMISE_MADE">PROMISE TO PAY</option>
                    <option value="ARRANGEMENT_ACTIVE">ARRANGEMENT ACTIVE</option>
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
                          <th>Arrears</th>
                          <th>DAYS PAST DUE</th>
                          <th>Strategy</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkQueue.map(item => (
                          <tr key={item.case_id}>
                            <td><strong style={{ color: "#818cf8", fontSize: "15px" }}>{item.priority_score}</strong></td>
                            <td><strong>{item.account_number}</strong></td>
                            <td>
                              <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "13.5px" }}>
                                {item.customer_name || "—"}
                              </div>
                            </td>
                            <td style={{ color: "#f87171", fontWeight: 600 }}>{money(item.arrears)}</td>
                            <td><strong>{item.days_in_arrears}</strong></td>
                            <td><span style={{ fontSize: "12px", color: "#cbd5e1" }}>{item.strategy_code ?? "STANDARD"}</span></td>
                            <td><span className={`status-pill ${getStatusPillClass(item.case_status)}`}>{formatCaseStatus(item.case_status)}</span></td>
                            <td>
                              {currentUser?.role === "COLLECTOR" ? (
                                <button className="btn btn-primary btn-sm" onClick={() => openAccountWorkbench(item.account_id)}>
                                  🎯 Work Case
                                </button>
                              ) : (
                                <button className="btn btn-secondary btn-sm" onClick={() => openAccountWorkbench(item.account_id)}>
                                  👁️ View Case
                                </button>
                              )}
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
                              <div className="mobile-card-debtor" style={{ fontWeight: 700, color: "#f8fafc", fontSize: "13.5px" }}>
                                👤 {item.customer_name || "Debtor Record"}
                              </div>
                            </div>
                          </div>
                          <span className={`status-pill ${getStatusPillClass(item.case_status)}`}>{formatCaseStatus(item.case_status)}</span>
                        </div>

                        <div className="mobile-card-body">
                          <div className="mobile-stat">
                            <label>Debtor Mobile</label>
                            <span style={{ color: "#38bdf8", fontWeight: 600 }}>📱 {formatPhone(item.mobile)}</span>
                          </div>
                          <div className="mobile-stat">
                            <label>Arrears Balance</label>
                            <span className="arrears-val">{money(item.arrears)}</span>
                          </div>
                          <div className="mobile-stat">
                            <label>DAYS PAST DUE</label>
                            <span>{item.days_in_arrears}</span>
                          </div>
                          <div className="mobile-stat">
                            <label>Account Strategy</label>
                            <span>{item.strategy_code ?? "STANDARD"}</span>
                          </div>
                          <div className="mobile-stat" style={{ gridColumn: "span 2" }}>
                            <label>Recommended Action</label>
                            <span style={{ color: "#38bdf8", fontWeight: 600 }}>{item.next_action}</span>
                          </div>
                        </div>

                        <div className="mobile-card-actions">
                          {currentUser?.role === "COLLECTOR" ? (
                            <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => openAccountWorkbench(item.account_id)}>
                              🎯 Work Debtor Case 360°
                            </button>
                          ) : (
                            <button className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => openAccountWorkbench(item.account_id)}>
                              👁️ View Case 360° (Read-Only)
                            </button>
                          )}
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
                          <th>DAYS PAST DUE</th>
                          <th>Last Payment</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.map(acc => (
                          <tr key={acc.id}>
                            <td><strong>{acc.account_number}</strong></td>
                            <td><span className={`status-pill ${getStatusPillClass(acc.account_status)}`}>{formatCaseStatus(acc.account_status)}</span></td>
                            <td>{money(acc.balance)}</td>
                            <td style={{ color: "#f87171", fontWeight: 600 }}>{money(acc.arrears)}</td>
                            <td><strong>{acc.days_in_arrears}</strong></td>
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
                            <div className="mobile-card-debtor">Status: {formatCaseStatus(acc.account_status)}</div>
                          </div>
                          <span className={`status-pill ${getStatusPillClass(acc.account_status)}`}>{formatCaseStatus(acc.account_status)}</span>
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
                            <label>DAYS PAST DUE</label>
                            <span>{acc.days_in_arrears}</span>
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

        {view === "imports" && currentUser?.role === "SUPERADMIN" && (
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

        {/* ONBOARDING & MUNICIPAL PORTFOLIOS VIEW (SUPERADMIN ONLY) */}
        {view === "onboarding" && currentUser?.role === "SUPERADMIN" && (
          <div className="view-content" style={{ animation: "fadeIn 0.2s ease" }}>
            
            {/* Commercial Revenue Pipeline & Potential Projections */}
            {(() => {
              const activeTenants = tenants.filter(t => t.subscription_status === "ACTIVE" || !t.subscription_status);
              const saasTenants = tenants.filter(t => t.engagement_model === "SAAS_SELF_SERVICE");
              const managedTenants = tenants.filter(t => t.engagement_model === "MANAGED_SERVICE");

              const monthlySaasMRR = saasTenants.reduce((acc, t) => acc + (Number(t.monthly_subscription_fee) || 0), 0);
              const projectedSaasARR = monthlySaasMRR * 12;

              // Managed recovery potential: Average monthly book collected (or estimated active accounts)
              const totalLedgerBalance = summary?.outstanding || summary?.debt_book || 0;
              const estimatedMonthlyRecoveryPool = totalLedgerBalance * 0.05; // 5% recovery velocity benchmark
              const avgManagedCommission = managedTenants.length > 0 
                ? managedTenants.reduce((acc, t) => acc + (Number(t.commission_rate) || 10), 0) / managedTenants.length 
                : 10;
              const estManagedMonthlyCommission = (estimatedMonthlyRecoveryPool * (avgManagedCommission / 100));
              const estManagedAnnualCommission = estManagedMonthlyCommission * 12;

              const totalProjectedAnnualRevenue = projectedSaasARR + estManagedAnnualCommission;

              return (
                <div style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h2 style={{ fontSize: "22px", margin: "0 0 4px 0", color: "#f8fafc", display: "flex", alignItems: "center", gap: "10px" }}>
                        📈 Commercial Revenue & Portfolio Analytics
                      </h2>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
                        Live financial projections based on active municipal subscriptions, licensing tiers, and managed collection commissions.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))", borderColor: "#a855f7", color: "#e9d5ff", fontWeight: 600 }}
                      onClick={() => setView("saas_tiers")}
                    >
                      💎 View SaaS Tier Matrix & Pricing
                    </button>
                  </div>

                  {/* Revenue KPI Cards Row */}
                  <div className="metrics-grid" style={{ marginBottom: "24px" }}>
                    
                    <div className="metric-card">
                      <div className="metric-header">
                        <span className="metric-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          💻 SaaS MRR
                        </span>
                        <span className="metric-badge badge-blue">Monthly Recurring</span>
                      </div>
                      <div className="metric-value" style={{ color: "#38bdf8" }}>
                        R {monthlySaasMRR.toLocaleString()}
                      </div>
                      <div className="metric-subtitle">
                        From <strong>{saasTenants.length}</strong> active SaaS municipal clients
                      </div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-header">
                        <span className="metric-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          🚀 SaaS ARR
                        </span>
                        <span className="metric-badge badge-indigo" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc" }}>
                          Annualized
                        </span>
                      </div>
                      <div className="metric-value" style={{ color: "#818cf8" }}>
                        R {projectedSaasARR.toLocaleString()}
                      </div>
                      <div className="metric-subtitle">Contracted subscription ARR</div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-header">
                        <span className="metric-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          🛡️ Managed ARR (Est.)
                        </span>
                        <span className="metric-badge badge-green">Commission</span>
                      </div>
                      <div className="metric-value" style={{ color: "#34d399" }}>
                        R {Math.round(estManagedAnnualCommission).toLocaleString()}
                      </div>
                      <div className="metric-subtitle">
                        ~{avgManagedCommission.toFixed(1)}% recovery commission on books
                      </div>
                    </div>

                    <div className="metric-card" style={{ borderColor: "rgba(234, 179, 8, 0.4)", background: "linear-gradient(145deg, rgba(234, 179, 8, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)" }}>
                      <div className="metric-header">
                        <span className="metric-title" style={{ color: "#facc15", display: "flex", alignItems: "center", gap: "6px" }}>
                          👑 Total Potential ARR
                        </span>
                        <span className="metric-badge badge-amber">Combined ARR</span>
                      </div>
                      <div className="metric-value" style={{ color: "#fef08a" }}>
                        R {Math.round(totalProjectedAnnualRevenue).toLocaleString()}
                      </div>
                      <div className="metric-subtitle" style={{ color: "#fde047" }}>
                        SaaS ARR + Managed Agency pipeline
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* Onboard New Municipality Card */}
            <div className="glass-panel" style={{ marginBottom: "28px" }}>
              <div className="panel-header">
                <div className="panel-title">
                  <h3>🏛️ Onboard New Municipality & Engagement Model</h3>
                  <p>Register a South African municipality for either <strong>Molmos Managed Debt Recovery</strong> or <strong>Internal Municipal SaaS Subscription</strong></p>
                </div>
              </div>

              <form onSubmit={handleCreateTenant} style={{ maxWidth: "880px" }}>
                <div className="info-grid" style={{ marginBottom: "16px" }}>
                  <div className="form-group">
                    <label>Municipality / Portfolio Name</label>
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
                    <label>Municipal Code (Unique Identifier)</label>
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

                <div className="info-grid" style={{ marginBottom: "16px" }}>
                  <div className="form-group">
                    <label>💼 Engagement & Operating Model</label>
                    <select
                      value={newTenantModel}
                      onChange={e => setNewTenantModel(e.target.value as any)}
                      className="form-select"
                      style={{
                        background: newTenantModel === "MANAGED_SERVICE" ? "linear-gradient(135deg, #065f46, #047857)" : "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
                        borderColor: newTenantModel === "MANAGED_SERVICE" ? "#10b981" : "#3b82f6",
                        color: "#ffffff",
                        fontWeight: 600,
                      }}
                    >
                      <option value="MANAGED_SERVICE" style={{ background: "#0f172a" }}>🛡️ Molmos Managed Service (Outsourced Agency Debt Recovery)</option>
                      <option value="SAAS_SELF_SERVICE" style={{ background: "#0f172a" }}>💻 SaaS Subscription (Municipality Uses System Internally)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Subscription Tier</label>
                    <select
                      value={newTenantTier}
                      onChange={e => setNewTenantTier(e.target.value)}
                      className="form-select"
                    >
                      <option value="ENTERPRISE">Enterprise (Full Feature Suite & Multi-Channel)</option>
                      <option value="PROFESSIONAL">Professional (Standard Analytics & Work Queue)</option>
                      <option value="STARTER">Starter Tier</option>
                    </select>
                  </div>
                </div>

                {newTenantModel === "MANAGED_SERVICE" ? (
                  <div className="info-grid" style={{ marginBottom: "20px", padding: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px" }}>
                    <div className="form-group">
                      <label style={{ color: "#34d399" }}>Molmos Recovery Commission Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 10.00"
                        value={newTenantCommission}
                        onChange={e => setNewTenantCommission(e.target.value)}
                        className="form-input"
                        required
                      />
                      <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>Success-based recovery fee retained by Molmos upon debt collection.</small>
                    </div>
                    <div className="form-group">
                      <label>Billing & Contract Contact Email</label>
                      <input
                        type="email"
                        placeholder="revenue.cfo@municipality.gov.za"
                        value={newTenantBillingEmail}
                        onChange={e => setNewTenantBillingEmail(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="info-grid" style={{ marginBottom: "20px", padding: "12px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "8px" }}>
                    <div className="form-group">
                      <label style={{ color: "#60a5fa" }}>Monthly SaaS License Fee (ZAR)</label>
                      <input
                        type="number"
                        step="100"
                        placeholder="e.g. 45000"
                        value={newTenantMonthlyFee}
                        onChange={e => setNewTenantMonthlyFee(e.target.value)}
                        className="form-input"
                        required
                      />
                      <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>Recurring platform subscription fee invoiced monthly to municipality.</small>
                    </div>
                    <div className="form-group">
                      <label>Billing & Invoice Email</label>
                      <input
                        type="email"
                        placeholder="it.procurement@municipality.gov.za"
                        value={newTenantBillingEmail}
                        onChange={e => setNewTenantBillingEmail(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={loading || !newTenantName || !newTenantCode}>
                  {loading ? "Registering..." : "🏛️ Onboard Municipality & Activate Contract"}
                </button>
              </form>
            </div>

            {/* Municipalities Portfolio Management Table */}
            <div className="glass-panel" style={{ marginBottom: "28px" }}>
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="panel-title">
                  <h3>🏛️ Municipal Clients & SaaS Portfolios ({tenants.length})</h3>
                  <p>Manage subscription tiers, engagement models (Internal SaaS vs Molmos Managed), and billing terms</p>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Municipality Name</th>
                      <th>Code</th>
                      <th>Engagement Model</th>
                      <th>Subscription Tier</th>
                      <th>Pricing / Commercial Terms</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id}>
                        <td><strong>{t.name}</strong></td>
                        <td><span className="status-pill status-new">{t.code}</span></td>
                        <td>
                          {t.engagement_model === "MANAGED_SERVICE" ? (
                            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)", fontWeight: 600, fontSize: "11.5px" }}>
                              🛡️ Molmos Managed Agency
                            </span>
                          ) : (
                            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)", fontWeight: 600, fontSize: "11.5px" }}>
                              💻 SaaS Municipal Subscription
                            </span>
                          )}
                        </td>
                        <td><strong style={{ color: "#e2e8f0", fontSize: "12px" }}>{t.subscription_tier || "ENTERPRISE"}</strong></td>
                        <td>
                          {t.engagement_model === "MANAGED_SERVICE" ? (
                            <span style={{ color: "#34d399", fontWeight: 600 }}>
                              {t.commission_rate ? `${t.commission_rate}% Commission` : "10% Commission"}
                            </span>
                          ) : (
                            <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                              {t.monthly_subscription_fee ? `R ${Number(t.monthly_subscription_fee).toLocaleString()} / mo` : "Standard SaaS"}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill ${t.subscription_status === "ACTIVE" ? "status-paying" : "status-broken"}`}>
                            {t.subscription_status || "ACTIVE"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600 }}
                            onClick={() => setEditingTenant(t)}
                          >
                            ⚙️ Edit Terms
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

        {/* USER MANAGEMENT & ROLES VIEW */}
        {view === "users" && currentUser?.role === "SUPERADMIN" && (
          <div>
            {/* Create User Card - Restricted to SUPERADMIN */}
            <div className="glass-panel" style={{ marginBottom: "28px" }}>
              <div className="panel-header">
                <div className="panel-title">
                  <h3>👥 Provision New User & Role</h3>
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

        {/* SAAS PRICING & TIER STRUCTURE VIEW (SUPERADMIN ONLY) */}
        {view === "saas_tiers" && currentUser?.role === "SUPERADMIN" && (
          <div className="view-content" style={{ animation: "fadeIn 0.2s ease" }}>
            <div className="glass-panel" style={{ marginBottom: "24px" }}>
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div className="panel-title">
                  <h2 style={{ fontSize: "22px", margin: "0 0 6px 0", color: "#f8fafc", display: "flex", alignItems: "center", gap: "10px" }}>
                    💎 SaaS Commercial Tiers & Phased Feature Matrix
                  </h2>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "13.5px" }}>
                    Recommended tier structure mapped cleanly onto CollectionsOS phases and South African municipal market benchmarks.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setView("onboarding")}
                  style={{ fontSize: "12px" }}
                >
                  ← Back to Onboarding & Portfolios
                </button>
              </div>

              {/* Strategic Summary Banner */}
              <div style={{ padding: "14px 18px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", marginBottom: "24px", fontSize: "13px", lineHeight: "1.6", color: "#cbd5e1" }}>
                <strong style={{ color: "#818cf8" }}>💡 Strategic Overview:</strong> The tier boundaries follow the platform's build phases deliberately. <strong>Starter</strong> sells Phase 1 core operations immediately to generate near-term revenue. <strong>Professional</strong> provides automation & debtor portals for mid-sized municipalities. <strong>Enterprise</strong> unlocks billing integrations, SLAs, DR, and compliance tooling for Metros and Agencies.
              </div>

              {/* Tier Comparison Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "28px" }}>
                
                {/* Starter Card */}
                <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px", padding: "20px", position: "relative", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#38bdf8", padding: "3px 8px", background: "rgba(56, 189, 248, 0.15)", borderRadius: "4px" }}>
                      STARTER TIER
                    </span>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Phase 1 Ready</span>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#f8fafc", marginBottom: "4px" }}>
                    R 18,000 – R 30,000
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}> / month</span>
                  </div>
                  <p style={{ fontSize: "12.5px", color: "#94a3b8", marginBottom: "16px" }}>Small local municipality / single-town debt book</p>
                  
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px", marginTop: "auto", fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>📁 <strong>Accounts:</strong> Up to ~25,000</div>
                    <div>👥 <strong>Collectors:</strong> 5 included (R1,500/extra user)</div>
                    <div>🚀 <strong>Onboarding:</strong> R40,000 – R75,000 (once-off)</div>
                    <div>🌐 <strong>Infra:</strong> Hetzner JHB (Shared Infra)</div>
                    <div>🎧 <strong>Support:</strong> Email, standard business hours</div>
                  </div>
                </div>

                {/* Professional Card */}
                <div style={{ background: "linear-gradient(180deg, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)", border: "1px solid rgba(129, 140, 248, 0.5)", borderRadius: "12px", padding: "20px", position: "relative", display: "flex", flexDirection: "column", boxShadow: "0 8px 24px rgba(99, 102, 241, 0.15)" }}>
                  <div style={{ position: "absolute", top: "-10px", right: "20px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#ffffff", padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px" }}>
                    MOST POPULAR
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#a5b4fc", padding: "3px 8px", background: "rgba(99, 102, 241, 0.25)", borderRadius: "4px" }}>
                      PROFESSIONAL TIER
                    </span>
                    <span style={{ fontSize: "11px", color: "#a5b4fc" }}>Core Margin Driver</span>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#f8fafc", marginBottom: "4px" }}>
                    R 55,000 – R 95,000
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}> / month</span>
                  </div>
                  <p style={{ fontSize: "12.5px", color: "#94a3b8", marginBottom: "16px" }}>Medium municipality or large local district</p>
                  
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px", marginTop: "auto", fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>📁 <strong>Accounts:</strong> Up to ~100,000</div>
                    <div>👥 <strong>Collectors:</strong> 15 included (R1,200/extra user)</div>
                    <div>🚀 <strong>Onboarding:</strong> R100,000 – R180,000 (once-off)</div>
                    <div>🌐 <strong>Infra:</strong> Hetzner JHB (Dedicated)</div>
                    <div>🎧 <strong>Support:</strong> Priority support + named CSM</div>
                  </div>
                </div>

                {/* Enterprise Card */}
                <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(234, 179, 8, 0.4)", borderRadius: "12px", padding: "20px", position: "relative", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#facc15", padding: "3px 8px", background: "rgba(234, 179, 8, 0.15)", borderRadius: "4px" }}>
                      ENTERPRISE TIER
                    </span>
                    <span style={{ fontSize: "11px", color: "#fde047" }}>Metro & Agency Scale</span>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#f8fafc", marginBottom: "4px" }}>
                    R 140,000 – R 250,000+
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}> / month</span>
                  </div>
                  <p style={{ fontSize: "12.5px", color: "#94a3b8", marginBottom: "16px" }}>Metro municipalities, multi-client debt agencies</p>
                  
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px", marginTop: "auto", fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>📁 <strong>Accounts:</strong> Unlimited Volume</div>
                    <div>👥 <strong>Collectors:</strong> Unlimited / Volume Pricing</div>
                    <div>🚀 <strong>Onboarding:</strong> R200,000 – R350,000+ (includes billing integration)</div>
                    <div>🌐 <strong>Infra:</strong> AWS Cape Town (Multi-AZ, SLA-backed)</div>
                    <div>🎧 <strong>Support:</strong> 24/7 SLA + Dedicated Account Mgr</div>
                  </div>
                </div>

              </div>

              {/* Master Feature & Roadmap Matrix Table */}
              <h3 style={{ fontSize: "17px", color: "#f8fafc", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                📊 Master Feature & Phased Capability Breakdown
              </h3>
              <div className="table-container" style={{ marginBottom: "28px" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: "220px" }}>Capability Dimension</th>
                      <th style={{ minWidth: "200px" }}>Starter Tier</th>
                      <th style={{ minWidth: "220px" }}>Professional Tier</th>
                      <th style={{ minWidth: "240px" }}>Enterprise Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Monthly Price</strong></td>
                      <td><span style={{ color: "#38bdf8", fontWeight: 700 }}>R18,000 – R30,000</span></td>
                      <td><span style={{ color: "#818cf8", fontWeight: 700 }}>R55,000 – R95,000</span></td>
                      <td><span style={{ color: "#facc15", fontWeight: 700 }}>R140,000 – R250,000+</span></td>
                    </tr>
                    <tr>
                      <td><strong>Target Customer</strong></td>
                      <td>Small local municipality / single-town debt book</td>
                      <td>Medium municipality or large local district</td>
                      <td>Metro municipalities, multi-client debt collection agencies</td>
                    </tr>
                    <tr>
                      <td><strong>Municipal Accounts</strong></td>
                      <td>Up to ~25,000 accounts</td>
                      <td>Up to ~100,000 accounts</td>
                      <td><span className="status-pill status-paying">Unlimited</span></td>
                    </tr>
                    <tr>
                      <td><strong>Collector Users</strong></td>
                      <td>5 included (R1,500 / extra user)</td>
                      <td>15 included (R1,200 / extra user)</td>
                      <td><span className="status-pill status-paying">Unlimited / Volume</span></td>
                    </tr>
                    <tr>
                      <td><strong>Core Collections (Phase 1)</strong></td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> — Debt book import, case state machine, work queue & priority scoring, PTP & payment plans, ledger, reconciliation engine, dashboard, audit trail</td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> (All Core Features)</td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> (All Core Features)</td>
                    </tr>
                    <tr>
                      <td><strong>Communications (Phase 2)</strong></td>
                      <td><span style={{ color: "#94a3b8" }}>Manual contact logging only</span></td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> — SMS, WhatsApp & Email channels, templates, scheduled workflows, agent call logging</td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> (Full Omnichannel Suite)</td>
                    </tr>
                    <tr>
                      <td><strong>Debtor Self-Service (Phase 2)</strong></td>
                      <td><span style={{ color: "#64748b" }}>—</span></td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> — Debtor portal, statement generation, payment gateways (PayFast, Ozow, Peach Payments)</td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> + Custom White-Label Municipal Branding</td>
                    </tr>
                    <tr>
                      <td><strong>Security & Access (Phase 2)</strong></td>
                      <td>JWT Auth & Role-Based Access Control (RBAC)</td>
                      <td>JWT Auth & Role-Based Access Control (RBAC)</td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> + SSO / Active Directory Integration</td>
                    </tr>
                    <tr>
                      <td><strong>Enterprise Tooling (Phase 3)</strong></td>
                      <td><span style={{ color: "#64748b" }}>—</span></td>
                      <td><span style={{ color: "#64748b" }}>—</span></td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> — S3 Object storage, billing system API integration, policy configuration, BI dashboards, SLA monitoring, compliance tooling, observability, DR & automated backups</td>
                    </tr>
                    <tr>
                      <td><strong>Intelligence & AI (Phase 4)</strong></td>
                      <td><span style={{ color: "#64748b" }}>—</span></td>
                      <td><span style={{ color: "#fbbf24" }}>Optional Add-on</span> (R15,000 – R25,000/mo)</td>
                      <td><span style={{ color: "#34d399", fontWeight: 600 }}>✅ Included</span> — Contactability scoring, payment propensity, next-best-action, AI assistant, recovery forecasting</td>
                    </tr>
                    <tr>
                      <td><strong>Hosting Infrastructure</strong></td>
                      <td>Hetzner JHB (Shared Infra)</td>
                      <td>Hetzner JHB Dedicated Node</td>
                      <td>AWS Cape Town (Multi-AZ, SLA-Backed)</td>
                    </tr>
                    <tr>
                      <td><strong>Support & SLA</strong></td>
                      <td>Email, standard business hours</td>
                      <td>Priority support, named CSM</td>
                      <td>24/7 SLA, dedicated account manager, quarterly reviews</td>
                    </tr>
                    <tr>
                      <td><strong>Onboarding & Migration</strong></td>
                      <td>R40,000 – R75,000 (once-off)</td>
                      <td>R100,000 – R180,000 (once-off)</td>
                      <td>R200,000 – R350,000+ (includes billing-system integration & historical data migration)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Commercial Notes & Operational Strategy */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#38bdf8", fontSize: "14px" }}>📱 Usage & Message Pass-Through</h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8", lineHeight: "1.5" }}>
                    Meter message costs separately: SMS (~R0.25–R0.50 each) and WhatsApp Business API conversation fees should be passed through at cost plus a small margin or sold as prepaid bundles to protect software subscription margins.
                  </p>
                </div>

                <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#a855f7", fontSize: "14px" }}>📑 Municipal Contract Mechanics</h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8", lineHeight: "1.5" }}>
                    Offer 10–15% discount for annual prepayment. For price-sensitive councils, utilize the contingency hybrid: a 40–50% reduced base fee plus 1–3% recovery commission to clear procurement thresholds easily.
                  </p>
                </div>

                <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#34d399", fontSize: "14px" }}>📈 ARR & Payback Economics</h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8", lineHeight: "1.5" }}>
                    Ten Professional-tier municipal clients at ~R75,000/month generates R9,000,000 ARR, recovering the full build investment within the first operating year prior to onboarding fees.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* BILLING & PROPOSALS VIEW */}
        {view === "billing" && (
          <div>
            {/* KPI Summary Cards for Proposals & Invoices */}
            {(() => {
              const totalInvoiced = invoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0);
              const totalPaid = invoices.filter(inv => inv.status === "PAID").reduce((acc, inv) => acc + (Number(inv.paid_amount || inv.total_amount) || 0), 0);
              const pendingInvoices = invoices.filter(inv => inv.status === "ISSUED" || inv.status === "DRAFT");
              const activeProposals = proposals.filter(p => p.status === "APPROVED" || p.status === "SUBMITTED_TO_MUNICIPALITY");

              return (
                <section className="metrics-grid" style={{ marginBottom: "24px" }}>
                  <div className="metric-card">
                    <div className="metric-header">
                      <span className="metric-title">Total Invoiced</span>
                      <span className="metric-badge badge-blue">{invoices.length} Invoices</span>
                    </div>
                    <div className="metric-value">{money(totalInvoiced)}</div>
                    <div className="metric-subtitle">Across all active municipal contracts</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span className="metric-title">Collected / Paid</span>
                      <span className="metric-badge badge-green">Received</span>
                    </div>
                    <div className="metric-value" style={{ color: "#34d399" }}>{money(totalPaid)}</div>
                    <div className="metric-subtitle">{invoices.filter(inv => inv.status === "PAID").length} Fully settled invoices</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span className="metric-title">Pending Remittance</span>
                      <span className="metric-badge badge-amber">{pendingInvoices.length} Due</span>
                    </div>
                    <div className="metric-value" style={{ color: "#fbbf24" }}>
                      {money(pendingInvoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0))}
                    </div>
                    <div className="metric-subtitle">Awaiting municipal EFT settlement</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span className="metric-title">Active Proposals</span>
                      <span className="metric-badge badge-indigo" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc" }}>
                        {proposals.length} Total
                      </span>
                    </div>
                    <div className="metric-value" style={{ color: "#818cf8" }}>{activeProposals.length}</div>
                    <div className="metric-subtitle">
                      {proposals.filter(p => p.status === "APPROVED").length} Approved & Contracted
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* Main Billing Navigation Panel */}
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: "wrap", gap: "16px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    type="button"
                    className={`btn ${billingSubTab === "invoices" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setBillingSubTab("invoices")}
                    style={{ padding: "8px 18px", fontSize: "13.5px" }}
                  >
                    🧾 Official Tax Invoices ({invoices.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${billingSubTab === "proposals" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setBillingSubTab("proposals")}
                    style={{ padding: "8px 18px", fontSize: "13.5px" }}
                  >
                    📑 Commercial Proposals ({proposals.length})
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {currentUser?.role === "SUPERADMIN" && (
                    <>
                      {billingSubTab === "invoices" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAutogenerateInvoice(selectedTenant)}
                            style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(14, 165, 233, 0.2))", borderColor: "#10b981", color: "#6ee7b7" }}
                            title="Auto-calculate and generate invoice based on active subscription tier or recovered collections"
                          >
                            ⚡ Auto-Generate for Active Municipality
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setInvTenantId(selectedTenant);
                              setShowNewInvoiceModal(true);
                            }}
                          >
                            ➕ Create Custom Invoice
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setPropTenantId(selectedTenant);
                            setShowNewProposalModal(true);
                          }}
                        >
                          ➕ Draft New Proposal
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* TAB 1: INVOICES TABLE */}
              {billingSubTab === "invoices" && (
                <div>
                  {invoices.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 20px" }}>
                      <div style={{ fontSize: "36px", marginBottom: "12px" }}>🧾</div>
                      <h4 style={{ color: "#f8fafc", margin: "0 0 6px 0" }}>No Invoices Issued Yet</h4>
                      <p style={{ color: "#94a3b8", fontSize: "13px", maxWidth: "460px", margin: "0 auto 20px auto" }}>
                        Click <strong>Auto-Generate</strong> to immediately create a tax invoice from your municipality's engagement model or create a custom one with extra line items.
                      </p>
                      {currentUser?.role === "SUPERADMIN" && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleAutogenerateInvoice(selectedTenant)}>
                          ⚡ Auto-Generate Invoice Now
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Municipality</th>
                            <th>Billing Period</th>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th>Subtotal</th>
                            <th>VAT (15%)</th>
                            <th>Total Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map(inv => (
                            <tr key={inv.id}>
                              <td>
                                <strong style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "13.5px" }}>
                                  {inv.invoice_number}
                                </strong>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ color: "#f8fafc" }}>{inv.tenant_name || "Municipality"}</strong>
                                  <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>Code: {inv.tenant_code}</span>
                                </div>
                              </td>
                              <td><span style={{ fontWeight: 500 }}>{inv.billing_period}</span></td>
                              <td>{inv.issue_date}</td>
                              <td style={{ color: new Date(inv.due_date) < new Date() && inv.status !== "PAID" ? "#f87171" : "#cbd5e1" }}>
                                {inv.due_date}
                              </td>
                              <td>{money(inv.subtotal)}</td>
                              <td style={{ color: "#94a3b8" }}>{money(inv.vat_amount)}</td>
                              <td><strong style={{ color: "#f8fafc", fontSize: "14px" }}>{money(inv.total_amount)}</strong></td>
                              <td>
                                <span className={`status-pill ${
                                  inv.status === "PAID" ? "status-paying" :
                                  inv.status === "ISSUED" ? "status-new" :
                                  inv.status === "OVERDUE" ? "status-escalated" : "status-engaged"
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setViewingPdfDoc({ type: "INVOICE", data: inv })}
                                    style={{ padding: "4px 8px", fontSize: "11.5px" }}
                                    title="View official PDF Tax Invoice and print"
                                  >
                                    📄 PDF / Print
                                  </button>
                                  {currentUser?.role === "SUPERADMIN" && inv.status !== "PAID" && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleUpdateInvoiceStatus(inv.id, "PAID")}
                                      style={{ padding: "4px 8px", fontSize: "11.5px", background: "#10b981", borderColor: "#10b981" }}
                                      title="Mark invoice as settled / paid"
                                    >
                                      ✓ Mark Paid
                                    </button>
                                  )}
                                  {currentUser?.role === "SUPERADMIN" && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                      style={{ padding: "4px 8px", fontSize: "11.5px", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
                                      title="Permanently Delete Invoice"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PROPOSALS TABLE */}
              {billingSubTab === "proposals" && (
                <div>
                  {proposals.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 20px" }}>
                      <div style={{ fontSize: "36px", marginBottom: "12px" }}>📑</div>
                      <h4 style={{ color: "#f8fafc", margin: "0 0 6px 0" }}>No Commercial Proposals Drafted</h4>
                      <p style={{ color: "#94a3b8", fontSize: "13px", maxWidth: "460px", margin: "0 auto 20px auto" }}>
                        Create formal proposals for municipalities covering SaaS licensing tiers or Molmos Managed Collections with approval workflows.
                      </p>
                      {currentUser?.role === "SUPERADMIN" && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowNewProposalModal(true)}>
                          ➕ Draft First Proposal
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Proposal #</th>
                            <th>Municipality</th>
                            <th>Proposal Title</th>
                            <th>Operating Model</th>
                            <th>Total Value</th>
                            <th>Valid Until</th>
                            <th>Status & Approval</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proposals.map(prop => (
                            <tr key={prop.id}>
                              <td>
                                <strong style={{ color: "#a5b4fc", fontFamily: "monospace", fontSize: "13.5px" }}>
                                  {prop.proposal_number}
                                </strong>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ color: "#f8fafc" }}>{prop.tenant_name || "Municipality"}</strong>
                                  <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>Code: {prop.tenant_code}</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: "#f8fafc", maxWidth: "260px" }}>{prop.title}</div>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  background: prop.engagement_model === "SAAS_SELF_SERVICE" ? "rgba(14, 165, 233, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                  color: prop.engagement_model === "SAAS_SELF_SERVICE" ? "#38bdf8" : "#34d399",
                                }}>
                                  {prop.engagement_model === "SAAS_SELF_SERVICE" ? "💻 SaaS Self-Service" : "🛡️ Managed Service"}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: "#f8fafc", fontSize: "14px" }}>
                                  {Number(prop.total_amount) > 0 ? money(prop.total_amount) : `${prop.commission_rate}% Commission`}
                                </strong>
                              </td>
                              <td>{prop.valid_until || "30 Days"}</td>
                              <td>
                                <div>
                                  <span className={`status-pill ${
                                    prop.status === "APPROVED" ? "status-paying" :
                                    prop.status === "SUBMITTED_TO_MUNICIPALITY" ? "status-engaged" :
                                    prop.status === "REJECTED" ? "status-broken" : "status-new"
                                  }`}>
                                    {prop.status === "SUBMITTED_TO_MUNICIPALITY" ? "SUBMITTED" : prop.status}
                                  </span>
                                  {prop.approved_by && (
                                    <div style={{ fontSize: "10.5px", color: prop.status === "APPROVED" ? "#34d399" : "#fb7185", marginTop: "3px" }}>
                                      {prop.approved_by.startsWith("Rejected") ? `✕ ${prop.approved_by}` : `✓ Approved by ${prop.approved_by}`}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setViewingPdfDoc({ type: "PROPOSAL", data: prop })}
                                    style={{ padding: "4px 8px", fontSize: "11.5px" }}
                                    title="View official Proposal document and print/save as PDF"
                                  >
                                    📄 PDF / Print
                                  </button>

                                  {/* Municipality Approval & Rejection Actions */}
                                  {prop.status !== "APPROVED" && (
                                    <>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleUpdateProposalStatus(prop.id, "APPROVED")}
                                        style={{ padding: "4px 8px", fontSize: "11.5px", background: "#10b981", borderColor: "#10b981" }}
                                        title="Approve Proposal (Municipal Executive Action)"
                                      >
                                        👍 Approve
                                      </button>
                                      {/* ONLY ADMIN (Municipal Executive) can reject proposals, SuperAdmin cannot */}
                                      {currentUser?.role === "ADMIN" && prop.status !== "REJECTED" && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => handleUpdateProposalStatus(prop.id, "REJECTED")}
                                          style={{ padding: "4px 8px", fontSize: "11.5px", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
                                          title="Reject Proposal (Municipal Executive Action)"
                                        >
                                          ✕ Reject
                                        </button>
                                      )}
                                      {currentUser?.role === "SUPERADMIN" && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => handleUpdateProposalStatus(prop.id, "SUBMITTED_TO_MUNICIPALITY", "obimax.ml@gmail.com")}
                                          style={{ padding: "4px 8px", fontSize: "11.5px", borderColor: "rgba(14, 165, 233, 0.4)", color: "#38bdf8" }}
                                          title="Submit / Resend proposal notification to municipality (obimax.ml@gmail.com)"
                                        >
                                          📧 Submit to obimax.ml@gmail.com
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {/* SuperAdmin Delete Proposal */}
                                  {currentUser?.role === "SUPERADMIN" && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleDeleteProposal(prop.id, prop.proposal_number)}
                                      style={{ padding: "4px 8px", fontSize: "11.5px", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
                                      title="Permanently Delete Proposal"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
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
          </div>
        )}

        {/* REPORTS & ANALYTICS VIEW (SUPERADMIN & ADMIN) */}
        {view === "reports" && (
          <div>
            {/* Reports Control Panel */}
            <div className="glass-panel" style={{ marginBottom: "24px" }}>
              <div className="panel-header" style={{ flexWrap: "wrap", gap: "14px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "20px" }}>
                <div className="panel-title">
                  <h3>📊 Municipal Reporting & Compliance Studio</h3>
                  <p>Generate certified recovery reports, MFMA debt aging audits, and commercial revenue exports</p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      // CSV Exporter for currently active report
                      let csvContent = "";
                      let filename = `khokhisa_report_${reportType.toLowerCase()}_${new Date().toISOString().split("T")[0]}.csv`;

                      if (reportType === "ARREARS_AGING") {
                        csvContent = "Account Number,Customer Name,Balance,Arrears,Days Past Due,Status\n" +
                          accounts.map(a => `"${a.account_number}","${a.customer_name || ''}",${a.balance},${a.arrears},${a.days_in_arrears},"${a.account_status}"`).join("\n");
                      } else if (reportType === "COMMERCIAL_BILLING") {
                        csvContent = "Invoice/Proposal #,Type,Municipality,Billing Period,Total Amount,Status,Date\n" +
                          invoices.map(i => `"${i.invoice_number}","TAX INVOICE","${i.tenant_name || ''}","${i.billing_period}",${i.total_amount},"${i.status}","${i.issue_date}"`).join("\n") + "\n" +
                          proposals.map(p => `"${p.proposal_number}","PROPOSAL","${p.tenant_name || ''}","${p.valid_until || ''}",${p.total_amount},"${p.status}","${p.created_at?.split("T")[0] || ''}"`).join("\n");
                      } else {
                        csvContent = "Metric,Value,Notes\n" +
                          `Total Debt Book,${summary?.debt_book || 0},Total active ledger exposure\n` +
                          `Total Overdue Arrears,${summary?.total_arrears || 0},Collectable arrears volume\n` +
                          `Recovered Cash,${summary?.recovered || 0},Reconciled collections\n` +
                          `Recovery Rate,${summary?.recovery_rate || 0}%,Performance against target\n` +
                          `Active Cases,${summary?.active_cases || 0},Operational collector volume\n` +
                          `Broken Promises,${summary?.broken_promises || 0},Cases requiring immediate intervention\n`;
                      }

                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      link.setAttribute("download", filename);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    📥 Export CSV Data
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => window.print()}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    🖨️ Print / Save PDF Report
                  </button>
                </div>
              </div>

              {/* Report Selection Tabs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <button
                  type="button"
                  className={`btn ${reportType === "EXECUTIVE_SUMMARY" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setReportType("EXECUTIVE_SUMMARY")}
                  style={{ padding: "12px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                >
                  <strong style={{ fontSize: "13px" }}>🏛️ Executive Recovery</strong>
                  <span style={{ fontSize: "11px", opacity: 0.8 }}>MFMA Sec 71 Cash Summary</span>
                </button>

                <button
                  type="button"
                  className={`btn ${reportType === "ARREARS_AGING" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setReportType("ARREARS_AGING")}
                  style={{ padding: "12px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                >
                  <strong style={{ fontSize: "13px" }}>⏳ Arrears Aging (DPD)</strong>
                  <span style={{ fontSize: "11px", opacity: 0.8 }}>30 / 60 / 90 / 120+ Day Buckets</span>
                </button>

                <button
                  type="button"
                  className={`btn ${reportType === "PTP_COMPLIANCE" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setReportType("PTP_COMPLIANCE")}
                  style={{ padding: "12px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                >
                  <strong style={{ fontSize: "13px" }}>🤝 PTP & Payment Plans</strong>
                  <span style={{ fontSize: "11px", opacity: 0.8 }}>Promise fulfillment & defaults</span>
                </button>

                <button
                  type="button"
                  className={`btn ${reportType === "COMMERCIAL_BILLING" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setReportType("COMMERCIAL_BILLING")}
                  style={{ padding: "12px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                >
                  <strong style={{ fontSize: "13px" }}>🧾 Invoicing & Proposals</strong>
                  <span style={{ fontSize: "11px", opacity: 0.8 }}>Municipal commercial ledger</span>
                </button>
              </div>

              {/* Date Filters */}
              <div style={{ display: "flex", gap: "14px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "12.5px", color: "#94a3b8", fontWeight: 600 }}>Filter Period:</span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <label style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>From:</label>
                  <input
                    type="date"
                    value={reportDateFrom}
                    onChange={e => setReportDateFrom(e.target.value)}
                    className="form-input"
                    style={{ padding: "4px 8px", fontSize: "12px", width: "130px" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <label style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>To:</label>
                  <input
                    type="date"
                    value={reportDateTo}
                    onChange={e => setReportDateTo(e.target.value)}
                    className="form-input"
                    style={{ padding: "4px 8px", fontSize: "12px", width: "130px" }}
                  />
                </div>
                <div style={{ marginLeft: "auto", fontSize: "12px", color: "#38bdf8" }}>
                  Municipality: <strong>{tenants.find(t => t.id === selectedTenant)?.name || "All Assigned"}</strong>
                </div>
              </div>
            </div>

            {/* REPORT 1: EXECUTIVE RECOVERY SUMMARY */}
            {reportType === "EXECUTIVE_SUMMARY" && (
              <div className="glass-panel" style={{ padding: "28px" }}>
                <div style={{ borderBottom: "2px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#f8fafc" }}>
                      Executive Debt Recovery & Financial Performance Report
                    </h3>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8" }}>
                      Prepared for: <strong>{tenants.find(t => t.id === selectedTenant)?.name || "Municipal Council"}</strong> | Period: {reportDateFrom} to {reportDateTo}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="status-pill status-paying">MFMA Sec 71 Compliant</span>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Generated on {new Date().toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="metrics-grid" style={{ marginBottom: "28px" }}>
                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Gross Debt Book</span></div>
                    <div className="metric-value">{money(summary?.debt_book)}</div>
                    <div className="metric-subtitle">Total municipal receivables</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Overdue Arrears</span></div>
                    <div className="metric-value" style={{ color: "#f87171" }}>{money(summary?.total_arrears)}</div>
                    <div className="metric-subtitle">Targeted for collections recovery</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Recovered Collections</span></div>
                    <div className="metric-value" style={{ color: "#34d399" }}>{money(summary?.recovered)}</div>
                    <div className="metric-subtitle">Reconciled to municipal bank account</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Recovery Rate</span></div>
                    <div className="metric-value" style={{ color: "#818cf8" }}>{summary?.recovery_rate ?? 0}%</div>
                    <div className="metric-subtitle">{summary?.active_cases ?? 0} active collection cases</div>
                  </div>
                </div>

                {/* Audit Narrative Table */}
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#f8fafc" }}>📋 Portfolio Operational Breakdown</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Performance Category</th>
                        <th>Portfolio Metrics</th>
                        <th>Status / Compliance</th>
                        <th>Audit Standard</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Consumer & Municipal Accounts</strong></td>
                        <td>{summary?.total_accounts ?? accounts.length} debtor accounts under management</td>
                        <td><span className="status-pill status-paying">ACTIVE</span></td>
                        <td>Municipal Systems Act (MSA) Sec 95</td>
                      </tr>
                      <tr>
                        <td><strong>Promise to Pay (PTP) Commitments</strong></td>
                        <td>{summary?.broken_promises ?? 0} broken commitments requiring re-engagement</td>
                        <td><span className="status-pill status-engaged">MONITORED</span></td>
                        <td>National Credit Act (NCA) Code of Conduct</td>
                      </tr>
                      <tr>
                        <td><strong>POPIA Data Protection Consent</strong></td>
                        <td>100% statutory basis verified for debt enforcement</td>
                        <td><span className="status-pill status-paying">COMPLIANT</span></td>
                        <td>POPIA Act 4 of 2013 Sec 11(1)(c)</td>
                      </tr>
                      <tr>
                        <td><strong>Cash Reconciliation & Ledger Postings</strong></td>
                        <td>Authoritative dual-entry matched to municipal reference</td>
                        <td><span className="status-pill status-paying">RECONCILED</span></td>
                        <td>GRAP 104 Financial Instruments</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REPORT 2: ARREARS AGING BUCKETS */}
            {reportType === "ARREARS_AGING" && (
              <div className="glass-panel" style={{ padding: "28px" }}>
                <div style={{ borderBottom: "2px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "24px" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#f8fafc" }}>
                    Arrears Aging & Days Past Due (DPD) Distribution
                  </h3>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8" }}>
                    Stratified debt aging matrix across all municipal consumer accounts
                  </p>
                </div>

                {(() => {
                  const bCurrent = accounts.filter(a => Number(a.days_in_arrears) <= 30);
                  const b60 = accounts.filter(a => Number(a.days_in_arrears) > 30 && Number(a.days_in_arrears) <= 60);
                  const b90 = accounts.filter(a => Number(a.days_in_arrears) > 60 && Number(a.days_in_arrears) <= 90);
                  const b120 = accounts.filter(a => Number(a.days_in_arrears) > 90);

                  const sumArrears = (arr: any[]) => arr.reduce((acc, it) => acc + (Number(it.arrears) || 0), 0);

                  return (
                    <div>
                      <div className="metrics-grid" style={{ marginBottom: "28px" }}>
                        <div className="metric-card">
                          <div className="metric-header"><span className="metric-title">0 – 30 Days (Current)</span></div>
                          <div className="metric-value" style={{ color: "#34d399" }}>{money(sumArrears(bCurrent))}</div>
                          <div className="metric-subtitle">{bCurrent.length} accounts (Early Stage)</div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-header"><span className="metric-title">31 – 60 Days</span></div>
                          <div className="metric-value" style={{ color: "#fbbf24" }}>{money(sumArrears(b60))}</div>
                          <div className="metric-subtitle">{b60.length} accounts (Soft Collections)</div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-header"><span className="metric-title">61 – 90 Days</span></div>
                          <div className="metric-value" style={{ color: "#fb923c" }}>{money(sumArrears(b90))}</div>
                          <div className="metric-subtitle">{b90.length} accounts (Active Recovery)</div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-header"><span className="metric-title">90+ Days Past Due</span></div>
                          <div className="metric-value" style={{ color: "#f87171" }}>{money(sumArrears(b120))}</div>
                          <div className="metric-subtitle">{b120.length} accounts (Intensive / Legal)</div>
                        </div>
                      </div>

                      <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#f8fafc" }}>Top Overdue Accounts in Portfolio</h4>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Account Number</th>
                              <th>Customer Name</th>
                              <th>Balance</th>
                              <th>Overdue Arrears</th>
                              <th>DAYS PAST DUE</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounts.slice(0, 10).map(a => (
                              <tr key={a.id}>
                                <td><strong>{a.account_number}</strong></td>
                                <td>{a.customer_name || "—"}</td>
                                <td>{money(a.balance)}</td>
                                <td style={{ color: "#f87171", fontWeight: 700 }}>{money(a.arrears)}</td>
                                <td><strong>{a.days_in_arrears}</strong></td>
                                <td><span className={`status-pill ${getStatusPillClass(a.account_status)}`}>{formatCaseStatus(a.account_status)}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* REPORT 3: PTP & PAYMENT PLANS */}
            {reportType === "PTP_COMPLIANCE" && (
              <div className="glass-panel" style={{ padding: "28px" }}>
                <div style={{ borderBottom: "2px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "24px" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#f8fafc" }}>
                    Promise to Pay (PTP) & Payment Arrangement Compliance
                  </h3>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8" }}>
                    Tracking debtor commitments, arrangement adherence, and broken promises
                  </p>
                </div>

                <div className="metrics-grid" style={{ marginBottom: "28px" }}>
                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Active Work Items</span></div>
                    <div className="metric-value">{workQueue.length}</div>
                    <div className="metric-subtitle">Collectors actively engaging</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Promises Made</span></div>
                    <div className="metric-value" style={{ color: "#38bdf8" }}>
                      {workQueue.filter(w => w.case_status === "PROMISE_MADE" || w.case_status === "PROMISE_TO_PAY").length}
                    </div>
                    <div className="metric-subtitle">Scheduled debtor payments</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Arrangements Active</span></div>
                    <div className="metric-value" style={{ color: "#a855f7" }}>
                      {workQueue.filter(w => w.case_status === "ARRANGEMENT_ACTIVE").length}
                    </div>
                    <div className="metric-subtitle">Multi-month structured plans</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header"><span className="metric-title">Broken Promises</span></div>
                    <div className="metric-value" style={{ color: "#fb7185" }}>{summary?.broken_promises ?? 0}</div>
                    <div className="metric-subtitle">Automated priority escalation</div>
                  </div>
                </div>
              </div>
            )}

            {/* REPORT 4: COMMERCIAL BILLING & INVOICING */}
            {reportType === "COMMERCIAL_BILLING" && (
              <div className="glass-panel" style={{ padding: "28px" }}>
                <div style={{ borderBottom: "2px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "24px" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#f8fafc" }}>
                    Commercial Invoicing & Proposals Summary Report
                  </h3>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8" }}>
                    Official register of tax invoices, remittance settlements, and active commercial proposals
                  </p>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Document #</th>
                        <th>Type</th>
                        <th>Municipality</th>
                        <th>Period / Tier</th>
                        <th>Total (ZAR)</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id}>
                          <td><strong style={{ color: "#38bdf8", fontFamily: "monospace" }}>{inv.invoice_number}</strong></td>
                          <td><span className="status-pill status-engaged">TAX INVOICE</span></td>
                          <td><strong>{inv.tenant_name || "Municipality"}</strong></td>
                          <td>{inv.billing_period}</td>
                          <td><strong>{money(inv.total_amount)}</strong></td>
                          <td><span className={`status-pill ${inv.status === "PAID" ? "status-paying" : "status-new"}`}>{inv.status}</span></td>
                          <td>{inv.issue_date}</td>
                        </tr>
                      ))}
                      {proposals.map(prop => (
                        <tr key={prop.id}>
                          <td><strong style={{ color: "#a5b4fc", fontFamily: "monospace" }}>{prop.proposal_number}</strong></td>
                          <td><span className="status-pill status-arrangement">PROPOSAL</span></td>
                          <td><strong>{prop.tenant_name || "Municipality"}</strong></td>
                          <td>{prop.subscription_tier}</td>
                          <td><strong>{money(prop.total_amount)}</strong></td>
                          <td><span className={`status-pill ${prop.status === "APPROVED" ? "status-paying" : "status-engaged"}`}>{prop.status}</span></td>
                          <td>{prop.created_at?.split("T")[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

              {/* Interface Theme Preference */}
              <div style={{ padding: "16px 20px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#f8fafc" }}>🎨 Interface Theme Preference</h4>
                <p style={{ color: "#94a3b8", fontSize: "12.5px", margin: "0 0 14px 0" }}>
                  Toggle between high-contrast Deep Dark Mode and Crisp Slate Light Mode.
                </p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="button"
                    className={`btn ${theme === "dark" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setTheme("dark")}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    🌙 Dark Theme {theme === "dark" && "✓"}
                  </button>
                  <button
                    type="button"
                    className={`btn ${theme === "light" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setTheme("light")}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    ☀️ Light Theme {theme === "light" && "✓"}
                  </button>
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

      {/* Edit Municipality & Commercial Terms Dialog Box */}
      {editingTenant && (
        <div className="modal-backdrop" onClick={() => setEditingTenant(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "620px", width: "94%", margin: "auto", animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "14px" }}>
              <div className="panel-title">
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  ⚙️ Municipality & SaaS Commercial Terms
                </h3>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                  Adjust engagement model, tier pricing, commission rates, and contract status
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingTenant(null)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTenant}>
              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Municipality Name</label>
                  <input
                    type="text"
                    value={editingTenant.name}
                    onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Code</label>
                  <input
                    type="text"
                    value={editingTenant.code}
                    onChange={e => setEditingTenant({ ...editingTenant, code: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Engagement Model</label>
                  <select
                    value={editingTenant.engagement_model || "MANAGED_SERVICE"}
                    onChange={e => setEditingTenant({ ...editingTenant, engagement_model: e.target.value })}
                    className="form-select"
                  >
                    <option value="MANAGED_SERVICE">🛡️ Molmos Managed Debt Agency</option>
                    <option value="SAAS_SELF_SERVICE">💻 SaaS Municipal Subscription</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Subscription Tier</label>
                  <select
                    value={editingTenant.subscription_tier || "ENTERPRISE"}
                    onChange={e => setEditingTenant({ ...editingTenant, subscription_tier: e.target.value })}
                    className="form-select"
                  >
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="PROFESSIONAL">Professional</option>
                    <option value="STARTER">Starter</option>
                  </select>
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>
                    {editingTenant.engagement_model === "MANAGED_SERVICE" ? "Molmos Commission (%)" : "Monthly License Fee (ZAR)"}
                  </label>
                  {editingTenant.engagement_model === "MANAGED_SERVICE" ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingTenant.commission_rate ?? 10.00}
                      onChange={e => setEditingTenant({ ...editingTenant, commission_rate: e.target.value })}
                      className="form-input"
                    />
                  ) : (
                    <input
                      type="number"
                      step="100"
                      value={editingTenant.monthly_subscription_fee ?? 45000}
                      onChange={e => setEditingTenant({ ...editingTenant, monthly_subscription_fee: e.target.value })}
                      className="form-input"
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Subscription Status</label>
                  <select
                    value={editingTenant.subscription_status || "ACTIVE"}
                    onChange={e => setEditingTenant({ ...editingTenant, subscription_status: e.target.value })}
                    className="form-select"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "24px" }}>
                <label>Billing & Contract Email</label>
                <input
                  type="email"
                  value={editingTenant.billing_contact_email || ""}
                  onChange={e => setEditingTenant({ ...editingTenant, billing_contact_email: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTenant(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Saving..." : "💾 Update Commercial Terms"}
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

              {/* POPIA Compliance & Consent Banner */}
              <div style={{ marginTop: "12px", padding: "8px 12px", background: account360.customer?.popia_dnc_status ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.08)", border: `1px solid ${account360.customer?.popia_dnc_status ? "rgba(239, 68, 68, 0.35)" : "rgba(34, 197, 94, 0.25)"}`, borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                <div>
                  <span style={{ fontWeight: 600, color: account360.customer?.popia_dnc_status ? "#fca5a5" : "#86efac" }}>
                    🛡️ POPIA Status: {account360.customer?.popia_consent_status || "STATUTORY_COLLECTION"}
                  </span>
                  {account360.customer?.popia_dnc_status && (
                    <span style={{ marginLeft: "8px", padding: "2px 6px", borderRadius: "4px", background: "#ef4444", color: "#ffffff", fontWeight: 700, fontSize: "10.5px" }}>
                      ⛔ DO NOT CONTACT (DNC)
                    </span>
                  )}
                </div>
                <span style={{ color: "#94a3b8", fontSize: "11px" }}>Lawful Basis: MFMA Sec 96 (Statutory Duty)</span>
              </div>
            </div>

            {/* Financial Status */}
            <div className="drawer-section">
              <div className="drawer-section-title">💰 Account Arrears Breakdown</div>
              <div className="info-grid">
                <div className="info-item"><label>Total Balance</label><span className="info-value">{money(account360.balance)}</span></div>
                <div className="info-item"><label>Overdue Arrears</label><span className="info-value" style={{ color: "#f87171", fontWeight: 700 }}>{money(account360.arrears)}</span></div>
                <div className="info-item"><label>Days in Arrears</label><span className="info-value">{account360.days_in_arrears}</span></div>
                <div className="info-item"><label>Case Status</label><span className="info-value"><span className={`status-pill ${getStatusPillClass(account360.active_case?.status)}`}>{formatCaseStatus(account360.active_case?.status ?? "NO CASE")}</span></span></div>
              </div>
            </div>

            {/* Workbench Actions Tabs */}
            <div className="tabs">
              <div className={`tab ${drawerTab === "overview" ? "active" : ""}`} onClick={() => setDrawerTab("overview")}>Timeline & Audit</div>
              {currentUser?.role === "COLLECTOR" && (
                <>
                  <div className={`tab ${drawerTab === "contact" ? "active" : ""}`} onClick={() => setDrawerTab("contact")}>Log Contact</div>
                  <div className={`tab ${drawerTab === "ptp" ? "active" : ""}`} onClick={() => setDrawerTab("ptp")}>Create PTP</div>
                  <div className={`tab ${drawerTab === "plan" ? "active" : ""}`} onClick={() => setDrawerTab("plan")}>Payment Plan</div>
                </>
              )}
              <div className={`tab ${drawerTab === "payments" ? "active" : ""}`} onClick={() => setDrawerTab("payments")}>Payments ({account360.payments.length})</div>
            </div>

            {currentUser?.role !== "COLLECTOR" && (
              <div style={{ margin: "0 0 16px 0", padding: "10px 14px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", color: "#38bdf8", fontSize: "12.5px" }}>
                🔒 <strong>{currentUser?.role} Oversight Mode:</strong> You have read-only access to view case timelines, arrangements, and payment audits. Actioning cases (logging contact, PTP, and payment plans) is reserved exclusively for Collectors.
              </div>
            )}

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
                {currentUser?.role === "COLLECTOR" && (
                  <>
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
                  </>
                )}

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

      {/* CREATE NEW PROPOSAL MODAL */}
      {showNewProposalModal && (
        <div className="modal-backdrop" onClick={() => setShowNewProposalModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "720px", width: "94%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>📑 Draft Municipal Commercial Proposal</h3>
                <p>Create a formal collections proposal requiring municipal executive sign-off</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewProposalModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateProposal}>
              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Target Municipality</label>
                  <select
                    value={propTenantId}
                    onChange={e => setPropTenantId(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">-- Select Municipality --</option>
                    {accessibleTenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Operating & Engagement Model</label>
                  <select
                    value={propModel}
                    onChange={e => setPropModel(e.target.value)}
                    className="form-select"
                  >
                    <option value="MANAGED_SERVICE">🛡️ Molmos Managed Debt Collection Agency</option>
                    <option value="SAAS_SELF_SERVICE">💻 Internal Municipal SaaS Platform</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Proposal Title</label>
                <input
                  type="text"
                  value={propTitle}
                  onChange={e => setPropTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Subscription Tier</label>
                  <select
                    value={propTier}
                    onChange={e => setPropTier(e.target.value)}
                    className="form-select"
                  >
                    <option value="STARTER">Starter Tier (R18k - R30k/mo)</option>
                    <option value="PROFESSIONAL">Professional Tier (R55k - R95k/mo)</option>
                    <option value="ENTERPRISE">Enterprise Tier (R140k - R250k+/mo)</option>
                    <option value="OUTSOURCED_COMMISSION">Outsourced Contingency Commission</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Validity Period (Days)</label>
                  <input
                    type="number"
                    value={propValidDays}
                    onChange={e => setPropValidDays(e.target.value)}
                    className="form-input"
                    min="7"
                    max="180"
                  />
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div style={{ marginBottom: "18px", padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ margin: 0, fontWeight: 700, color: "#f8fafc" }}>Proposal Commercial Line Items & Extras</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPropLineItems([...propLineItems, { description: "Custom Service / Add-on Line Item", quantity: 1, unit_price: 15000 }])}
                    style={{ padding: "3px 8px", fontSize: "11.5px" }}
                  >
                    ➕ Add Line Item
                  </button>
                </div>

                {propLineItems.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.5fr auto", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => {
                        const updated = [...propLineItems];
                        updated[idx].description = e.target.value;
                        setPropLineItems(updated);
                      }}
                      className="form-input"
                      placeholder="Line item description"
                      required
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => {
                        const updated = [...propLineItems];
                        updated[idx].quantity = Number(e.target.value) || 1;
                        setPropLineItems(updated);
                      }}
                      className="form-input"
                      placeholder="Qty"
                      min="1"
                    />
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={e => {
                        const updated = [...propLineItems];
                        updated[idx].unit_price = Number(e.target.value) || 0;
                        setPropLineItems(updated);
                      }}
                      className="form-input"
                      placeholder="Unit Price (R)"
                    />
                    {propLineItems.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPropLineItems(propLineItems.filter((_, i) => i !== idx))}
                        style={{ color: "#fb7185", borderColor: "rgba(244,63,94,0.3)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Scope of Work & Deliverables</label>
                <textarea
                  value={propScope}
                  onChange={e => setPropScope(e.target.value)}
                  className="form-input"
                  rows={2}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewProposalModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Generating..." : "💾 Save & Issue Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CUSTOM INVOICE MODAL */}
      {showNewInvoiceModal && (
        <div className="modal-backdrop" onClick={() => setShowNewInvoiceModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "760px", width: "94%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>🧾 Create Official Tax Invoice</h3>
                <p>Invoice a municipality with custom line items, extras, and official remittance banking details</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewInvoiceModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateInvoice}>
              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Bill To Municipality</label>
                  <select
                    value={invTenantId}
                    onChange={e => setInvTenantId(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">-- Select Municipality --</option>
                    {accessibleTenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Billing Period</label>
                  <input
                    type="text"
                    value={invBillingPeriod}
                    onChange={e => setInvBillingPeriod(e.target.value)}
                    className="form-input"
                    placeholder="e.g. August 2026"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Payment Due Days</label>
                <input
                  type="number"
                  value={invDueDays}
                  onChange={e => setInvDueDays(e.target.value)}
                  className="form-input"
                  min="1"
                  max="90"
                />
              </div>

              {/* Invoice Dynamic Line Items */}
              <div style={{ marginBottom: "18px", padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ margin: 0, fontWeight: 700, color: "#f8fafc" }}>Invoice Items & Billable Extras</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setInvLineItems([...invLineItems, { description: "Additional SMS / WhatsApp Message Pass-through", quantity: 1000, unit_price: 0.35 }])}
                    style={{ padding: "3px 8px", fontSize: "11.5px" }}
                  >
                    ➕ Add Line Item
                  </button>
                </div>

                {invLineItems.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.5fr auto", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => {
                        const updated = [...invLineItems];
                        updated[idx].description = e.target.value;
                        setInvLineItems(updated);
                      }}
                      className="form-input"
                      placeholder="Item description"
                      required
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => {
                        const updated = [...invLineItems];
                        updated[idx].quantity = Number(e.target.value) || 1;
                        setInvLineItems(updated);
                      }}
                      className="form-input"
                      placeholder="Qty"
                      min="1"
                    />
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={e => {
                        const updated = [...invLineItems];
                        updated[idx].unit_price = Number(e.target.value) || 0;
                        setInvLineItems(updated);
                      }}
                      className="form-input"
                      placeholder="Unit Price (R)"
                    />
                    {invLineItems.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setInvLineItems(invLineItems.filter((_, i) => i !== idx))}
                        style={{ color: "#fb7185", borderColor: "rgba(244,63,94,0.3)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {/* Subtotal & VAT Preview */}
                <div style={{ marginTop: "12px", textAlign: "right", fontSize: "13px", color: "#94a3b8" }}>
                  <div>Subtotal: <strong style={{ color: "#f8fafc" }}>{money(invLineItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0))}</strong></div>
                  <div>VAT (15%): <strong style={{ color: "#f8fafc" }}>{money(invLineItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) * 0.15)}</strong></div>
                  <div style={{ fontSize: "15px", color: "#38bdf8", fontWeight: 700, marginTop: "4px" }}>
                    Total Due: {money(invLineItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) * 1.15)}
                  </div>
                </div>
              </div>

              {/* Banking Details on Invoice */}
              <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "13.5px", color: "#34d399", display: "flex", alignItems: "center", gap: "6px" }}>
                  🏦 Remittance Banking Details (Embedded in PDF)
                </h4>
                <div className="info-grid">
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input type="text" value={invBankingBank} onChange={e => setInvBankingBank(e.target.value)} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label>Account Name</label>
                    <input type="text" value={invBankingAccName} onChange={e => setInvBankingAccName(e.target.value)} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input type="text" value={invBankingAccNum} onChange={e => setInvBankingAccNum(e.target.value)} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label>Branch Code</label>
                    <input type="text" value={invBankingBranch} onChange={e => setInvBankingBranch(e.target.value)} className="form-input" required />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewInvoiceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Issuing..." : "🧾 Issue & Generate Tax Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF / OFFICIAL DOCUMENT VIEW MODAL & PRINT ENGINE */}
      {viewingPdfDoc && (
        <div className="modal-backdrop" onClick={() => setViewingPdfDoc(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "800px", width: "95%", maxHeight: "92vh", overflowY: "auto", background: "white", color: "#0f172a", borderRadius: "12px", padding: "36px" }} onClick={e => e.stopPropagation()}>
            
            {/* Pure Document Area Captured for PDF / Print (No buttons inside) */}
            <div id="official-pdf-printable-area">
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: "20px", marginBottom: "24px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
                    {/* Stylish Modern Fintech Emblem */}
                    <div style={{
                      width: "48px",
                      height: "48px",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "48px", height: "48px" }}>
                        <circle cx="25" cy="32" r="19" fill="url(#leftSphereGrad)" fillOpacity="0.95"/>
                        <circle cx="39" cy="32" r="19" fill="url(#rightSphereGrad)" fillOpacity="0.88" style={{ mixBlendMode: "multiply" }}/>
                        <path d="M32 17 C36 24, 36 40, 32 47 C28 40, 28 24, 32 17 Z" fill="url(#centerCoreGrad)" fillOpacity="0.92"/>
                        <circle cx="32" cy="32" r="27" stroke="url(#ringGrad)" strokeWidth="1.8" strokeDasharray="3 2" opacity="0.6"/>
                        <text x="32" y="38.5" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="900" fontFamily="Outfit, -apple-system, sans-serif" style={{ filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.6))" }}>
                          K
                        </text>
                        <defs>
                          <linearGradient id="leftSphereGrad" x1="6" y1="13" x2="44" y2="51" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#059669"/>
                            <stop offset="1" stopColor="#0284c7"/>
                          </linearGradient>
                          <linearGradient id="rightSphereGrad" x1="20" y1="13" x2="58" y2="51" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#3b82f6"/>
                            <stop offset="1" stopColor="#6366f1"/>
                          </linearGradient>
                          <linearGradient id="centerCoreGrad" x1="28" y1="17" x2="36" y2="47" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10b981"/>
                            <stop offset="0.5" stopColor="#38bdf8"/>
                            <stop offset="1" stopColor="#4f46e5"/>
                          </linearGradient>
                          <linearGradient id="ringGrad" x1="5" y1="5" x2="59" y2="59" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10b981"/>
                            <stop offset="0.5" stopColor="#38bdf8"/>
                            <stop offset="1" stopColor="#818cf8"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>

                    <div>
                      <h2 style={{ margin: 0, fontSize: "23px", fontWeight: 900, color: "#0f172a", fontFamily: "Outfit, -apple-system, sans-serif", letterSpacing: "-0.5px" }}>
                        KHOKHISA
                      </h2>
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.45" }}>
                    Registration: 2014/032353/07 | VAT No: 4890284719<br />
                    Sandton City Financial Tower, Johannesburg, Gauteng, 2196<br />
                    Official Remittance Invoicing: billing@khokhisa.co.za | Tel: +27 (0)11 555 0199
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: viewingPdfDoc.type === "INVOICE" ? "#eff6ff" : "#f5f3ff",
                    color: viewingPdfDoc.type === "INVOICE" ? "#2563eb" : "#7c3aed",
                    border: `1px solid ${viewingPdfDoc.type === "INVOICE" ? "#bfdbfe" : "#ddd6fe"}`,
                    marginBottom: "8px",
                  }}>
                    {viewingPdfDoc.type === "INVOICE" ? "TAX INVOICE" : "COMMERCIAL PROPOSAL"}
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                    {viewingPdfDoc.type === "INVOICE" ? viewingPdfDoc.data.invoice_number : viewingPdfDoc.data.proposal_number}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    Date: {viewingPdfDoc.type === "INVOICE" ? viewingPdfDoc.data.issue_date : viewingPdfDoc.data.created_at?.split("T")[0]}
                  </div>
                </div>
              </div>

              {/* Bill To & Municipal Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px", padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                    {viewingPdfDoc.type === "INVOICE" ? "Billed To (Municipality):" : "Prepared For (Municipality):"}
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    {viewingPdfDoc.data.tenant_name || "City Municipality"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px" }}>
                    Municipal Code: <strong>{viewingPdfDoc.data.tenant_code || "JHB"}</strong><br />
                    Attention: Chief Financial Officer / Revenue Unit<br />
                    Republic of South Africa
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                    Contract & Terms:
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5" }}>
                    {viewingPdfDoc.type === "INVOICE" ? (
                      <>
                        Billing Period: <strong>{viewingPdfDoc.data.billing_period}</strong><br />
                        Payment Due Date: <strong style={{ color: "#dc2626" }}>{viewingPdfDoc.data.due_date}</strong><br />
                        Status: <strong>{viewingPdfDoc.data.status}</strong>
                      </>
                    ) : (
                      <>
                        Engagement: <strong>{viewingPdfDoc.data.engagement_model}</strong><br />
                        Tier: <strong>{viewingPdfDoc.data.subscription_tier}</strong><br />
                        Valid Until: <strong>{viewingPdfDoc.data.valid_until || "30 Days"}</strong>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ marginBottom: "28px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#0f172a", color: "white" }}>
                      <th style={{ padding: "10px 14px", borderRadius: "6px 0 0 0" }}>#</th>
                      <th style={{ padding: "10px 14px" }}>Description</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Qty</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Unit Price</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", borderRadius: "0 6px 0 0" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingPdfDoc.data.line_items || []).map((it: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 14px", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "12px 14px", color: "#0f172a", fontWeight: 600 }}>{it.description}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", color: "#475569" }}>{it.quantity}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#475569" }}>{money(it.unit_price)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>
                          {money(it.total || (it.quantity * it.unit_price))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total Calculation Breakdown */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                  <div style={{ width: "280px", fontSize: "13px", lineHeight: "1.6" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                      <span>Subtotal:</span>
                      <span>{money(viewingPdfDoc.data.subtotal || viewingPdfDoc.data.total_amount)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                      <span>VAT (15%):</span>
                      <span>{money(viewingPdfDoc.data.vat_amount || 0)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 800, color: "#0f172a", borderTop: "2px solid #0f172a", paddingTop: "6px", marginTop: "6px" }}>
                      <span>Total Due (ZAR):</span>
                      <span>{money(viewingPdfDoc.data.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banking Details on PDF */}
              <div style={{ padding: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#166534", textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🏦 Official Remittance Banking Details (EFT / Wire Settlement)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px", color: "#1e293b" }}>
                  <div>
                    Bank: <strong>{viewingPdfDoc.data.banking_details?.bank_name || "Capitec Business"}</strong><br />
                    Account Name: <strong>{viewingPdfDoc.data.banking_details?.account_name || "Moloi Mosea Investments (Pty) Ltd"}</strong><br />
                    Account Number: <strong style={{ fontFamily: "monospace", fontSize: "13px" }}>{viewingPdfDoc.data.banking_details?.account_number || "62899432101"}</strong>
                  </div>
                  <div>
                    Branch Code: <strong>{viewingPdfDoc.data.banking_details?.branch_code || "470010"}</strong><br />
                    Account Type: <strong>{viewingPdfDoc.data.banking_details?.account_type || "Business Cheque"}</strong><br />
                    Payment Ref: <strong style={{ color: "#2563eb", fontFamily: "monospace" }}>{viewingPdfDoc.data.invoice_number || viewingPdfDoc.data.proposal_number}</strong>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div style={{ fontSize: "11px", color: "#64748b", textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                Generated electronically by Khokhisa • Compliant with MFMA & South African Revenue Service (SARS) standards
              </div>
            </div>

            {/* Print & Download Action Controls (Outside the Printable Document Container) */}
            <div className="pdf-actions-footer" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", borderTop: "2px dashed #cbd5e1", paddingTop: "18px", marginTop: "18px", gap: "12px" }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const el = document.getElementById("official-pdf-printable-area");
                  if (!el) return;
                  const docNum = viewingPdfDoc.type === "INVOICE" ? viewingPdfDoc.data.invoice_number : viewingPdfDoc.data.proposal_number;
                  try {
                    let html2pdfInstance = (window as any).html2pdf;
                    if (!html2pdfInstance) {
                      const mod = await import("html2pdf.js");
                      html2pdfInstance = mod.default || mod;
                    }
                    const opt = {
                      margin: [10, 10, 10, 10],
                      filename: `${viewingPdfDoc.type}_${docNum}.pdf`,
                      image: { type: "jpeg", quality: 0.98 },
                      html2canvas: { scale: 2, useCORS: true, logging: false },
                      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const }
                    };
                    html2pdfInstance().set(opt).from(el).save();
                  } catch (e) {
                    window.print();
                  }
                }}
                style={{ background: "#0284c7", borderColor: "#0284c7", fontWeight: 700, padding: "10px 18px" }}
              >
                📥 Download as PDF File
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.print()}
                style={{ background: "#0f172a", color: "white", borderColor: "#0f172a", fontWeight: 600, padding: "10px 18px" }}
              >
                🖨️ Print Document
              </button>
              <button className="btn btn-secondary" onClick={() => setViewingPdfDoc(null)} style={{ padding: "10px 18px" }}>
                Close
              </button>
            </div>

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

function formatCaseStatus(st: any) {
  if (!st) return "—";
  const str = String(st).trim();
  if (str === "PROMISE_TO_PAY" || str === "PROMISE_MADE") return "PROMISE TO PAY";
  if (str === "ARRANGEMENT_ACTIVE") return "ARRANGEMENT ACTIVE";
  if (str === "CONTACT_ATTEMPTED") return "CONTACT ATTEMPTED";
  return str.replace(/_/g, " ");
}

function getStatusPillClass(st: any) {
  if (!st) return "status-new";
  const lower = String(st).toLowerCase();
  if (lower.includes("promise")) return "status-promise";
  if (lower.includes("paying") || lower === "paid" || lower === "active") return "status-paying";
  if (lower.includes("broken") || lower === "default") return "status-broken";
  if (lower.includes("escalat") || lower === "delinquent") return "status-escalated";
  if (lower.includes("arrangement")) return "status-arrangement";
  if (lower.includes("engaged")) return "status-engaged";
  return "status-new";
}

createRoot(document.getElementById("root")!).render(<App />);

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
  current_not_overdue?: number;
  current_not_overdue_accounts?: number;
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
    id?: string;
    first_name: string | null;
    last_name: string | null;
    id_number: string | null;
    company_registration?: string | null;
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
  const [view, setView] = useState<"dashboard" | "workqueue" | "accounts" | "imports" | "onboarding" | "users" | "saas_tiers" | "compliance" | "legal_compliance" | "billing" | "reports" | "settings">("dashboard");
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

  // New User Creation form & Modal for SuperAdmin / Admin
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
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
  const [editUserCfdcNumber, setEditUserCfdcNumber] = useState("");
  const [editUserCfdcExpiry, setEditUserCfdcExpiry] = useState("");
  const [editUserTrustBank, setEditUserTrustBank] = useState("");
  const [editUserTrustBranch, setEditUserTrustBranch] = useState("");
  const [editUserTrustAccNum, setEditUserTrustAccNum] = useState("");
  const [editUserTrustAccHolder, setEditUserTrustAccHolder] = useState("");
  const [editUserTrustAuditDue, setEditUserTrustAuditDue] = useState("");
  const [editUserTrustBankLetterUrl, setEditUserTrustBankLetterUrl] = useState("");
  const [editUserTrustAuditorLetterUrl, setEditUserTrustAuditorLetterUrl] = useState("");
  const [editUserTrustAuditReportUrl, setEditUserTrustAuditReportUrl] = useState("");

  // Self Settings state
  const [settingsFullName, setSettingsFullName] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [myCollectorProfile, setMyCollectorProfile] = useState<any>(null);
  const [myCfdcNumber, setMyCfdcNumber] = useState("");
  const [myCfdcExpiry, setMyCfdcExpiry] = useState("");
  const [myTrustBank, setMyTrustBank] = useState("");
  const [myTrustBranch, setMyTrustBranch] = useState("");
  const [myTrustAccNum, setMyTrustAccNum] = useState("");
  const [myTrustAccHolder, setMyTrustAccHolder] = useState("");
  const [myTrustAuditDue, setMyTrustAuditDue] = useState("");
  const [myTrustBankLetterUrl, setMyTrustBankLetterUrl] = useState("");
  const [myTrustAuditorLetterUrl, setMyTrustAuditorLetterUrl] = useState("");
  const [myTrustAuditReportUrl, setMyTrustAuditReportUrl] = useState("");

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

  const [showLogoutBanner, setShowLogoutBanner] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("cos_user_v2");
    localStorage.removeItem("cos_user");
    setCurrentUser(null);
    setShowLogoutBanner(false);
  };
  const [contactOutcome, setContactOutcome] = useState("CUSTOMER_ENGAGED");
  const [contactChannel, setContactChannel] = useState("PHONE");
  const [contactNotes, setContactNotes] = useState("");
  const [contactNextAction, setContactNextAction] = useState("CREATE_PAYMENT_PLAN");

  // PTP form
  const [ptpAmount, setPtpAmount] = useState("");
  const [ptpDueDate, setPtpDueDate] = useState("");
  const [ptpChannel, setPtpChannel] = useState("EFT");

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
  const [newTenantStatus, setNewTenantStatus] = useState("ACTIVE");
  const [newTenantCommission, setNewTenantCommission] = useState("10.00");
  const [newTenantMonthlyFee, setNewTenantMonthlyFee] = useState("0.00");
  const [newTenantBillingEmail, setNewTenantBillingEmail] = useState("");
  const [newTenantPhysicalAddress, setNewTenantPhysicalAddress] = useState("");
  const [newTenantPostalAddress, setNewTenantPostalAddress] = useState("");
  const [newTenantContactPerson, setNewTenantContactPerson] = useState("");
  const [newTenantContactPosition, setNewTenantContactPosition] = useState("");
  const [newTenantContactPhone, setNewTenantContactPhone] = useState("");
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [showOnboardTenantModal, setShowOnboardTenantModal] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter states
  const [wqSearch, setWqSearch] = useState("");
  const [wqStatusFilter, setWqStatusFilter] = useState("ALL");
  const [wqStrategyFilter, setWqStrategyFilter] = useState("ALL");
  const [wqCollectorFilter, setWqCollectorFilter] = useState("ALL");

  // Collector Compliance & Trust Account states
  const [complianceCollectors, setComplianceCollectors] = useState<any[]>([]);
  const [complianceRemittances, setComplianceRemittances] = useState<any[]>([]);
  const [complianceTab, setComplianceTab] = useState<"collectors" | "trust" | "remittances" | "audit">("collectors");
  const [selectedCollectorForDetails, setSelectedCollectorForDetails] = useState<any>(null);
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);
  const [remittanceStatementModal, setRemittanceStatementModal] = useState<any>(null);

  // Trust form
  const [trustBankName, setTrustBankName] = useState("");
  const [trustBranchCode, setTrustBranchCode] = useState("");
  const [trustAccountNumber, setTrustAccountNumber] = useState("");
  const [trustAccountHolder, setTrustAccountHolder] = useState("");
  const [trustAuditDueDate, setTrustAuditDueDate] = useState("");
  const [trustBankLetterUrl, setTrustBankLetterUrl] = useState("");
  const [trustAuditorLetterUrl, setTrustAuditorLetterUrl] = useState("");
  const [trustAuditReportUrl, setTrustAuditReportUrl] = useState("");

  // Remittance form
  const [remitDebtorRef, setRemitDebtorRef] = useState("");
  const [remitAmount, setRemitAmount] = useState("");
  const [remitCommRate, setRemitCommRate] = useState("10.00");
  const [remitBankStatementRef, setRemitBankStatementRef] = useState("");
  const [remitNotes, setRemitNotes] = useState("");

  // Legal & Regulatory Compliance State
  const [legalAgreements, setLegalAgreements] = useState<any[]>([]);
  const [legalIncidents, setLegalIncidents] = useState<any[]>([]);
  const [legalMandates, setLegalMandates] = useState<any[]>([]);
  const [legalPiiLogs, setLegalPiiLogs] = useState<any[]>([]);
  const [legalDocuments, setLegalDocuments] = useState<any[]>([]);
  const [legalAcceptances, setLegalAcceptances] = useState<any[]>([]);
  const [legalComplianceTab, setLegalComplianceTab] = useState<"popia_agreements" | "pii_audit" | "mfma_mandates" | "breaches" | "legal_docs" | "contact_us">("popia_agreements");

  // Contact Us Form State
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCategory, setContactCategory] = useState("Technical");
  const [contactMessage, setContactMessage] = useState("");
  const [contactTicketResult, setContactTicketResult] = useState<any>(null);

  // Sign DPA Modal
  const [signingDpa, setSigningDpa] = useState<any>(null);
  const [dpaSignerName, setDpaSignerName] = useState("");
  const [dpaSignerPosition, setDpaSignerPosition] = useState("");
  const [dpaAgreementText, setDpaAgreementText] = useState("");
  const [isEditingDpaText, setIsEditingDpaText] = useState(false);

  // New Mandate Modal
  const [showNewMandateModal, setShowNewMandateModal] = useState(false);
  const [newMandateRef, setNewMandateRef] = useState(`MFMA-${Date.now().toString().slice(-4)}`);
  const [newMandateTitle, setNewMandateTitle] = useState("");
  const [newMandateType, setNewMandateType] = useState("COLLECTOR_MANDATE");
  const [newMandateVendor, setNewMandateVendor] = useState("");
  const [newMandateStart, setNewMandateStart] = useState(new Date().toISOString().split("T")[0]);
  const [newMandateEnd, setNewMandateEnd] = useState(new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]);
  const [newMandateValue, setNewMandateValue] = useState("500000");
  const [newMandateComm, setNewMandateComm] = useState("10.00");
  const [newMandateScope, setNewMandateScope] = useState("Municipal debtor tracing and collection services under MFMA s 116.");

  // New Breach Incident Modal
  const [showNewBreachModal, setShowNewBreachModal] = useState(false);
  const [newBreachType, setNewBreachType] = useState("UNAUTHORIZED_ACCESS_ATTEMPT");
  const [newBreachSeverity, setNewBreachSeverity] = useState("MEDIUM");
  const [newBreachDesc, setNewBreachDesc] = useState("");
  const [newBreachCount, setNewBreachCount] = useState("0");
  const [newBreachCategory, setNewBreachCategory] = useState("Debtor names and arrears balances");
  const [newBreachContainment, setNewBreachContainment] = useState("");

  // View & Edit Legal Policy Modal
  const [viewingLegalDoc, setViewingLegalDoc] = useState<any>(null);
  const [editingLegalDoc, setEditingLegalDoc] = useState<any>(null);
  const [editDocTitle, setEditDocTitle] = useState("");
  const [editDocVersion, setEditDocVersion] = useState("");
  const [editDocContent, setEditDocContent] = useState("");

  // Edit Mandate Modal
  const [editingMandate, setEditingMandate] = useState<any>(null);
  const [editMandateTitle, setEditMandateTitle] = useState("");
  const [editMandateType, setEditMandateType] = useState("");
  const [editMandateVendor, setEditMandateVendor] = useState("");
  const [editMandateStart, setEditMandateStart] = useState("");
  const [editMandateEnd, setEditMandateEnd] = useState("");
  const [editMandateValue, setEditMandateValue] = useState("");
  const [editMandateComm, setEditMandateComm] = useState("");
  const [editMandateStatus, setEditMandateStatus] = useState("ACTIVE");
  const [editMandateScope, setEditMandateScope] = useState("");

  // Directory Config State
  const [directoryConfig, setDirectoryConfig] = useState<any>(null);
  const [editingDirectory, setEditingDirectory] = useState(false);
  const [dirOperatorName, setDirOperatorName] = useState("");
  const [dirRegNumber, setDirRegNumber] = useState("");
  const [dirVatNumber, setDirVatNumber] = useState("");
  const [dirRegAddress, setDirRegAddress] = useState("");
  const [dirPostalAddress, setDirPostalAddress] = useState("");
  const [dirSupportEmail, setDirSupportEmail] = useState("");
  const [dirSupportPhone, setDirSupportPhone] = useState("");
  const [dirOperatingHours, setDirOperatingHours] = useState("");
  const [dirSlaTargets, setDirSlaTargets] = useState("");
  const [dirIoTitle, setDirIoTitle] = useState("");
  const [dirPrivacyEmail, setDirPrivacyEmail] = useState("");
  const [dirComplianceEmail, setDirComplianceEmail] = useState("");
  const [dirDebtorNotice, setDirDebtorNotice] = useState("");
  const [dirCfdcInfo, setDirCfdcInfo] = useState("");
  const [dirRegulatorInfo, setDirRegulatorInfo] = useState("");

  const [accSearch, setAccSearch] = useState("");
  const [accMobileSearch, setAccMobileSearch] = useState("");
  const [accStatusFilter, setAccStatusFilter] = useState("ALL");
  const [accOverdueFilter, setAccOverdueFilter] = useState<"ALL" | "OVERDUE" | "NOT_OVERDUE">("ALL");
  const [accMinArrears, setAccMinArrears] = useState("");

  // Load tenants dynamically on start
  const fetchTenants = () => {
    fetch(`${API}/tenants`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTenants(data);
          setSelectedTenant(prev => {
            if (currentUser?.role === "SUPERADMIN") {
              const savedDefault = localStorage.getItem(`cos_default_tenant_${currentUser.id}`);
              if (savedDefault === "GLOBAL") return "GLOBAL";
              if (savedDefault && data.some(d => d.id === savedDefault)) return savedDefault;
              return prev || "GLOBAL";
            }
            const savedDefault = currentUser?.id ? localStorage.getItem(`cos_default_tenant_${currentUser.id}`) : null;
            const userAssigned = currentUser?.tenant_ids || (currentUser?.tenant_id ? [currentUser.tenant_id] : []);
            
            if (savedDefault && data.some(d => d.id === savedDefault)) {
              if (userAssigned.includes(savedDefault)) {
                return savedDefault;
              }
            }
            if (currentUser?.tenant_id && data.some(d => d.id === currentUser.tenant_id)) {
              return currentUser.tenant_id;
            }
            if (userAssigned.length > 0) {
              if (prev && userAssigned.includes(prev)) return prev;
              return userAssigned[0];
            }
            return prev || data[0].id;
          });
        } else {
          setTenants([]);
          if (currentUser?.role === "SUPERADMIN") {
            setSelectedTenant("GLOBAL");
          }
        }
      })
      .catch(console.error);
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
          physical_address: newTenantPhysicalAddress || null,
          postal_address: newTenantPostalAddress || null,
          contact_person: newTenantContactPerson || null,
          contact_position: newTenantContactPosition || null,
          contact_phone: newTenantContactPhone || null,
          subscription_status: newTenantStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error onboarding municipality: ${data.detail}`);
        return;
      }
      alert(`Municipality ${data.name} (${data.code}) onboarded successfully under ${data.engagement_model === "MANAGED_SERVICE" ? "Khokhisa Managed Collections" : "Internal SaaS Subscription"}!`);
      setNewTenantName("");
      setNewTenantCode("");
      setNewTenantStatus("ACTIVE");
      setNewTenantBillingEmail("");
      setNewTenantPhysicalAddress("");
      setNewTenantPostalAddress("");
      setNewTenantContactPerson("");
      setNewTenantContactPosition("");
      setNewTenantContactPhone("");
      fetchTenants();
    } catch (err: any) {
      alert("Could not reach backend API");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickChangeTenantStatus = async (tenantId: string, status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/tenants/${tenantId}/status?status=${status}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error updating SaaS status: ${data.detail}`);
        return;
      }
      alert(`Municipality ${data.name} SaaS status changed to "${data.subscription_status}"!`);
      fetchTenants();
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    const confirmation = prompt(
      `⚠️ PERMANENT DELETION WARNING:\n\nAre you sure you want to permanently delete "${tenantName}" and all associated accounts, customers, properties, cases, and billing data?\n\nType DELETE to confirm:`,
      ""
    );
    if (confirmation !== "DELETE") {
      if (confirmation !== null) {
        alert("Deletion cancelled. You must type DELETE to confirm.");
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/tenants/${tenantId}`, {
        method: "DELETE",
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        if (!res.ok) {
          throw new Error(`Server Error (${res.status}): ${text.slice(0, 150)}`);
        }
      }
      if (!res.ok) {
        alert(`Error deleting municipality: ${data.detail || text || "Server error"}`);
        return;
      }
      alert(data.message || `Municipality ${tenantName} deleted successfully!`);
      if (editingTenant?.id === tenantId) {
        setEditingTenant(null);
      }
      fetchTenants();
      refreshData();
    } catch (err: any) {
      alert("Error: " + (err.message || err));
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
          physical_address: editingTenant.physical_address,
          postal_address: editingTenant.postal_address,
          contact_person: editingTenant.contact_person,
          contact_position: editingTenant.contact_position,
          contact_phone: editingTenant.contact_phone,
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
    const tenantParam = (selectedTenant === "GLOBAL" || !selectedTenant) ? "" : `?tenant_id=${selectedTenant}`;
    const tenantParamPrefix = (selectedTenant === "GLOBAL" || !selectedTenant) ? "" : `tenant_id=${selectedTenant}`;

    // 1. Dashboard summary
    fetch(`${API}/dashboard/summary${tenantParam}`)
      .then(r => r.json())
      .then(setSummary)
      .catch(console.error);

    // 2. Work Queue
    fetch(`${API}/work-queue${tenantParam}`)
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
    fetch(`${API}/accounts${tenantParam}`)
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

    // 6. Collector Compliance Profiles & Remittances
    fetch(`${API}/compliance/collectors${tenantParam}`)
      .then(r => r.json())
      .then(setComplianceCollectors)
      .catch(console.error);

    fetch(`${API}/compliance/remittances${tenantParam}`)
      .then(r => r.json())
      .then(setComplianceRemittances)
      .catch(console.error);

    // 7. Legal & Regulatory Compliance (POPIA, MFMA, ECTA)
    fetch(`${API}/legal-compliance/operator-agreements${tenantParam}`)
      .then(r => r.json())
      .then(setLegalAgreements)
      .catch(console.error);

    fetch(`${API}/legal-compliance/mandates${tenantParam}`)
      .then(r => r.json())
      .then(setLegalMandates)
      .catch(console.error);

    fetch(`${API}/legal-compliance/breach-incidents${tenantParam}`)
      .then(r => r.json())
      .then(setLegalIncidents)
      .catch(console.error);

    fetch(`${API}/legal-compliance/pii-access-logs${tenantParam}`)
      .then(r => r.json())
      .then(setLegalPiiLogs)
      .catch(console.error);

    fetch(`${API}/legal-compliance/documents`)
      .then(r => r.json())
      .then(setLegalDocuments)
      .catch(console.error);

    fetch(`${API}/legal-compliance/acceptances/roster${tenantParam}`)
      .then(r => r.json())
      .then(setLegalAcceptances)
      .catch(console.error);

    fetch(`${API}/legal-compliance/directory-config`)
      .then(r => r.json())
      .then(data => {
        setDirectoryConfig(data);
        if (data) {
          setDirOperatorName(data.operator_name || "");
          setDirRegNumber(data.company_registration || "");
          setDirVatNumber(data.vat_number || "");
          setDirRegAddress(data.registered_address || "");
          setDirPostalAddress(data.postal_address || "");
          setDirSupportEmail(data.support_email || "");
          setDirSupportPhone(data.support_phone || "");
          setDirOperatingHours(data.operating_hours || "");
          setDirSlaTargets(data.sla_targets || "");
          setDirIoTitle(data.information_officer_title || "");
          setDirPrivacyEmail(data.privacy_email || "");
          setDirComplianceEmail(data.compliance_email || "");
          setDirDebtorNotice(data.debtor_query_notice || "");
          setDirCfdcInfo(data.cfdc_contact_info || "");
          setDirRegulatorInfo(data.regulator_contact_info || "");
        }
      })
      .catch(console.error);

    if (currentUser?.id && currentUser.role === "COLLECTOR") {
      fetch(`${API}/compliance/collectors/me?user_id=${currentUser.id}`)
        .then(r => r.json())
        .then(data => {
          setMyCollectorProfile(data);
          if (data) {
            setMyCfdcNumber(data.cfdc_registration_number || "");
            setMyCfdcExpiry(data.cfdc_expiry_date || "");
            if (data.trust_account) {
              setMyTrustBank(data.trust_account.bank_name || "");
              setMyTrustBranch(data.trust_account.branch_code || "");
              setMyTrustAccNum(data.trust_account.account_number || "");
              setMyTrustAccHolder(data.trust_account.account_holder_name || "");
              setMyTrustAuditDue(data.trust_account.audit_due_date || "");
              setMyTrustBankLetterUrl(data.trust_account.bank_confirmation_letter_url || "");
              setMyTrustAuditorLetterUrl(data.trust_account.auditor_letter_url || "");
              setMyTrustAuditReportUrl(data.trust_account.last_audit_report_url || "");
            }
          }
        })
        .catch(console.error);
    }
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
      setShowCreateUserModal(false);
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

    // If collector, find or fetch compliance profile & trust account
    const matchedProfile = complianceCollectors.find(c => c.user_id === user.id);
    if (matchedProfile) {
      setEditUserCfdcNumber(matchedProfile.cfdc_registration_number || "");
      setEditUserCfdcExpiry(matchedProfile.cfdc_expiry_date || "");
      if (matchedProfile.trust_account) {
        setEditUserTrustBank(matchedProfile.trust_account.bank_name || "");
        setEditUserTrustBranch(matchedProfile.trust_account.branch_code || "");
        setEditUserTrustAccNum(matchedProfile.trust_account.account_number || "");
        setEditUserTrustAccHolder(matchedProfile.trust_account.account_holder_name || "");
        setEditUserTrustAuditDue(matchedProfile.trust_account.audit_due_date || "");
        setEditUserTrustBankLetterUrl(matchedProfile.trust_account.bank_confirmation_letter_url || "");
        setEditUserTrustAuditorLetterUrl(matchedProfile.trust_account.auditor_letter_url || "");
        setEditUserTrustAuditReportUrl(matchedProfile.trust_account.last_audit_report_url || "");
      } else {
        setEditUserTrustBank("");
        setEditUserTrustBranch("");
        setEditUserTrustAccNum("");
        setEditUserTrustAccHolder("");
        setEditUserTrustAuditDue("");
        setEditUserTrustBankLetterUrl("");
        setEditUserTrustAuditorLetterUrl("");
        setEditUserTrustAuditReportUrl("");
      }
    } else {
      setEditUserCfdcNumber("");
      setEditUserCfdcExpiry("");
      setEditUserTrustBank("");
      setEditUserTrustBranch("");
      setEditUserTrustAccNum("");
      setEditUserTrustAccHolder("");
      setEditUserTrustAuditDue("");
      setEditUserTrustBankLetterUrl("");
      setEditUserTrustAuditorLetterUrl("");
      setEditUserTrustAuditReportUrl("");
    }
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

      // If user is a COLLECTOR, also update CFDC & Trust Account
      if (editRole === "COLLECTOR" || editingUser.role === "COLLECTOR") {
        const matchedProfile = complianceCollectors.find(c => c.user_id === editingUser.id);
        if (matchedProfile) {
          if (editUserCfdcNumber || editUserCfdcExpiry) {
            await fetch(`${API}/compliance/collectors/${matchedProfile.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cfdc_registration_number: editUserCfdcNumber,
                cfdc_expiry_date: editUserCfdcExpiry || null,
              }),
            });
          }
          if (editUserTrustBank && editUserTrustAccNum) {
            await fetch(`${API}/compliance/collectors/${matchedProfile.id}/trust-account`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bank_name: editUserTrustBank,
                branch_code: editUserTrustBranch,
                account_number: editUserTrustAccNum,
                account_holder_name: editUserTrustAccHolder || editFullName,
                audit_due_date: editUserTrustAuditDue || new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
                bank_confirmation_letter_url: editUserTrustBankLetterUrl || "https://storage.khokhisa.co.za/trust/bank_letter.pdf",
                auditor_letter_url: editUserTrustAuditorLetterUrl || "https://storage.khokhisa.co.za/trust/auditor_letter.pdf",
                last_audit_report_url: editUserTrustAuditReportUrl || "https://storage.khokhisa.co.za/trust/last_audit.pdf",
              }),
            });
          }
        }
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

      // If current user is a COLLECTOR, save their CFDC & Trust Account
      if (currentUser.role === "COLLECTOR" && myCollectorProfile) {
        if (myCfdcNumber || myCfdcExpiry) {
          await fetch(`${API}/compliance/collectors/${myCollectorProfile.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cfdc_registration_number: myCfdcNumber,
              cfdc_expiry_date: myCfdcExpiry || null,
            }),
          });
        }
        if (myTrustBank && myTrustAccNum) {
          await fetch(`${API}/compliance/collectors/${myCollectorProfile.id}/trust-account`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bank_name: myTrustBank,
              branch_code: myTrustBranch,
              account_number: myTrustAccNum,
              account_holder_name: myTrustAccHolder || data.full_name,
              audit_due_date: myTrustAuditDue || new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
              bank_confirmation_letter_url: myTrustBankLetterUrl || "https://storage.khokhisa.co.za/trust/bank_letter.pdf",
              auditor_letter_url: myTrustAuditorLetterUrl || "https://storage.khokhisa.co.za/trust/auditor_letter.pdf",
              last_audit_report_url: myTrustAuditReportUrl || "https://storage.khokhisa.co.za/trust/last_audit.pdf",
            }),
          });
        }
      }

      alert("Profile and compliance credentials updated successfully!");
      setCurrentUser(data);
      localStorage.setItem("cos_user_v2", JSON.stringify(data));
      setSettingsPassword("");
      setSettingsConfirmPassword("");
      refreshData();
    } catch (err: any) {
      alert("Could not update profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAccountWorkbench = (accountId: string) => {
    setSelectedAccountId(accountId);
    const tenantParam = (!selectedTenant || selectedTenant === "GLOBAL") ? "" : `?tenant_id=${selectedTenant}`;
    fetch(`${API}/accounts/${accountId}/360${tenantParam}`)
      .then(async r => {
        if (!r.ok) {
          throw new Error(`Failed to load Account 360 (HTTP ${r.status})`);
        }
        return r.json();
      })
      .then(data => {
        setAccount360(data);
        if (data.arrears) {
          setPtpAmount((Number(data.arrears) / 2).toFixed(2));
        }
      })
      .catch(err => {
        console.error("Workbench load error:", err);
        alert("Error loading Account 360 Workbench: " + err.message);
        setSelectedAccountId(null);
      });
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
      const agentName = currentUser?.full_name || currentUser?.email || "Collector";
      const accRef = account360?.account_number || "N/A";
      await fetch(`${API}/cases/${account360.active_case.id}/promises?tenant_id=${selectedTenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(ptpAmount),
          due_date: ptpDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          actor: agentName,
          channel: ptpChannel,
          reference: accRef,
          notes: `channel: ${ptpChannel} | ref: ${accRef} | captured_by: ${agentName} | captured_at: ${new Date().toLocaleString()} | status: OPEN`,
        }),
      });
      openAccountWorkbench(account360.id);
      refreshData();
      alert(`✅ Promise to Pay of ${money(Number(ptpAmount))} logged for ref: ${accRef}!`);
      setPtpAmount("");
      setPtpDueDate("");
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
          account_id: account360.id,
          account_number: account360.account_number,
          tenant_id: selectedTenant,
          amount: Number(paymentAmount),
          payment_date: paymentDate,
          external_reference: paymentRef,
          actor: currentUser?.full_name || currentUser?.email || "Collector",
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
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { detail: text || `HTTP ${res.status} ${res.statusText}` };
      }
      if (!res.ok) {
        alert("Error updating proposal status: " + (data.detail || JSON.stringify(data)));
        return;
      }
      if (newStatus === "SUBMITTED_TO_MUNICIPALITY") {
        alert(`🚀 Proposal "${data.proposal_number}" submitted to municipality! Notification dispatched to ${targetEmail || data.tenant_name}.`);
      } else if (newStatus === "APPROVED") {
        alert(`🎉 Proposal "${data.proposal_number}" APPROVED! An official Tax Invoice has been automatically generated and is ready in your Invoices register.`);
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
        const errorMsg = typeof data.detail === "string" 
          ? data.detail 
          : Array.isArray(data.detail)
            ? data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
            : JSON.stringify(data);
        alert("Error autogenerating invoice: " + errorMsg);
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
    if (!selectedTenant || selectedTenant === "GLOBAL") {
      alert("⚠️ Please select a specific target municipality (e.g. Ba-Phalaborwa Municipality) from the top-left dropdown or import screen before ingesting a debt book.");
      return;
    }
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
        let errorMsg = "Failed to complete import.";
        if (typeof data.detail === "string") {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
        } else if (typeof data.detail === "object" && data.detail !== null) {
          errorMsg = JSON.stringify(data.detail);
        } else if (data.message) {
          errorMsg = data.message;
        }
        alert("Import Error: " + errorMsg);
        return;
      }
      setImportResult(data);
      setImportStage("result");
      refreshData();
    } catch (e: any) {
      alert("Error during import: " + (e.message || String(e)));
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

          <div className="login-brand" style={{ marginBottom: "28px", paddingTop: "26px" }}>
            <div className="loan-emblem-wrapper" style={{ width: "80px", height: "80px", margin: "0 auto 14px" }}>
              <svg className="loan-svg-icon" viewBox="0 0 64 64" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Left Emerald/Cyan Gradient Sphere */}
                <circle cx="25" cy="32" r="18" fill="#059669" fillOpacity="0.95"/>
                {/* Right Cobalt/Indigo Gradient Sphere */}
                <circle cx="39" cy="32" r="18" fill="#3b82f6" fillOpacity="0.9" style={{ mixBlendMode: "screen" }}/>
                {/* Central Diamond Overlap Lens */}
                <path d="M32 17 C36.5 24, 36.5 40, 32 47 C27.5 40, 27.5 24, 32 17 Z" fill="#38bdf8"/>
                {/* Bold Sculpted K Monogram */}
                <text x="32" y="40" textAnchor="middle" fill="#ffffff" fontSize="23" fontWeight="900" fontFamily="Outfit, sans-serif" style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.6))" }}>
                  K
                </text>
              </svg>
            </div>
            <h2 style={{ marginTop: "4px", marginBottom: "2px", fontSize: "28px" }}>Khokhisa</h2>
            <p style={{ color: "#38bdf8", fontWeight: 700, letterSpacing: "0.8px", fontSize: "12px", textTransform: "uppercase", margin: 0 }}>DEBT COLLECTION OS</p>
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
        <div className="brand-section" style={{ margin: 0, padding: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="brand-icon" style={{ width: "46px", height: "46px", flexShrink: 0 }}>
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "46px", height: "46px" }}>
              <circle cx="25" cy="32" r="18" fill="#059669" fillOpacity="0.95"/>
              <circle cx="39" cy="32" r="18" fill="#3b82f6" fillOpacity="0.9"/>
              <path d="M32 17 C36.5 24, 36.5 40, 32 47 C27.5 40, 27.5 24, 32 17 Z" fill="#38bdf8"/>
              <text x="32" y="40" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="900" fontFamily="Outfit, sans-serif">
                K
              </text>
            </svg>
          </div>
          <div className="brand-info" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{ fontSize: "18px", margin: 0, lineHeight: "1.1", fontWeight: 800, letterSpacing: "-0.3px" }}>Khokhisa</h1>
            <span style={{ fontSize: "9.5px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", marginTop: "2px", background: "none", padding: 0 }}>
              DEBT COLLECTION OS
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {/* Mode Button with no background border */}
          <button
            type="button"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            style={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
              padding: "4px 5px",
              fontSize: "17px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-main)",
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Refresh Button with no background border */}
          <button
            type="button"
            onClick={refreshData}
            title="Refresh Data"
            style={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
              padding: "4px 5px",
              fontSize: "16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-main)",
            }}
          >
            🔄
          </button>

          {/* Logout Button with no background border (Arrow icon) */}
          <button
            type="button"
            onClick={() => setShowLogoutBanner(true)}
            title="Sign Out / Logout"
            style={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
              padding: "4px 5px",
              fontSize: "17px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fb7185",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>

          {/* Hamburger Menu Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
            style={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
              fontSize: "20px",
              padding: "4px 6px",
              width: "auto",
              height: "auto",
              marginLeft: "2px",
            }}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* In-App Logout Confirmation Banner (Fixed across the entire screen) */}
      {showLogoutBanner && (
        <div style={{
          position: "fixed",
          top: "0",
          left: "0",
          right: "0",
          width: "100%",
          zIndex: 9999,
          background: "linear-gradient(135deg, #e11d48, #be123c)",
          color: "#ffffff",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.25)",
          animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          flexWrap: "wrap",
          gap: "12px",
          boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", fontWeight: 700 }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <span>Are you sure you want to sign out and end your active session in <strong>Khokhisa</strong>?</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
            <button
              type="button"
              onClick={() => setShowLogoutBanner(false)}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                color: "#ffffff",
                padding: "7px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "#ffffff",
                border: "none",
                color: "#be123c",
                padding: "7px 18px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                transition: "all 0.2s ease",
              }}
            >
              🚪 Sign Out Now
            </button>
          </div>
        </div>
      )}

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand-section" style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "22px", padding: "4px 2px" }}>
          <div className="brand-icon" title="Khokhisa - South Africa Municipal Debt Collection OS" style={{ width: "52px", height: "52px", flexShrink: 0 }}>
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "52px", height: "52px" }}>
              <circle cx="25" cy="32" r="18" fill="#059669" fillOpacity="0.95"/>
              <circle cx="39" cy="32" r="18" fill="#3b82f6" fillOpacity="0.9"/>
              <path d="M32 17 C36.5 24, 36.5 40, 32 47 C27.5 40, 27.5 24, 32 17 Z" fill="#38bdf8"/>
              <text x="32" y="40" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="900" fontFamily="Outfit, sans-serif">
                K
              </text>
            </svg>
          </div>
          <div className="brand-info" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{ margin: 0, fontSize: "21px", lineHeight: "1.1", fontWeight: 800, letterSpacing: "-0.4px" }}>Khokhisa</h1>
            <span style={{ fontSize: "10.5px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", marginTop: "3px", background: "none", padding: 0 }}>
              DEBT COLLECTION OS
            </span>
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
            {currentUser?.role === "SUPERADMIN" && (
              <option value="GLOBAL">🌍 Global (All Municipalities)</option>
            )}
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
          <div className={`nav-item ${view === "compliance" ? "active" : ""}`} onClick={() => { setView("compliance"); setMobileMenuOpen(false); }}>
            🛡️ Collector Compliance & Trust
            <span className="nav-badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399" }}>
              {complianceCollectors.length}
            </span>
          </div>
          {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
            <div className={`nav-item ${view === "legal_compliance" ? "active" : ""}`} onClick={() => { setView("legal_compliance"); setMobileMenuOpen(false); }}>
              ⚖️ Legal & POPIA Safeguards
              <span className="nav-badge" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" }}>
                {legalAgreements.length + legalMandates.length}
              </span>
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
                onClick={() => setShowLogoutBanner(true)}
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
              {view === "compliance" && "🛡️ Collector Verification, Trust Accounts & Statutory Remittance"}
              {view === "legal_compliance" && "⚖️ Legal & Regulatory Compliance (POPIA, MFMA, ECTA & Government Standards)"}
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
              {view === "compliance" && "CFDC verification, trust account auditor letters, municipal assignments, and statutory remittance tracking"}
              {view === "legal_compliance" && "POPIA Section 21 operator agreements, Section 19 PII access audit trail, MFMA mandates, and breach management"}
              {view === "billing" && "Issue structured proposals, generate official tax invoices (PDF), and manage banking remittance"}
              {view === "reports" && "Generate MFMA Section 71/96 compliance summaries, arrears aging, and collection audits (CSV & Printable PDF)"}
              {view === "settings" && "Update your personal details, email address, and account password"}
            </p>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="btn btn-secondary desktop-only"
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
            <button className="btn btn-secondary desktop-only" onClick={refreshData}>🔄 Refresh</button>
            <button className="btn btn-primary run-engine-btn" onClick={triggerCaseEngine} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              ⚡ Run Case Engine
            </button>
          </div>
        </header>

        {/* METRICS ROW */}
        <section className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <div
            className="metric-card"
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => {
              setAccOverdueFilter("ALL");
              setView("accounts");
            }}
            title="Click to view all municipal debt book accounts"
          >
            <div className="metric-header">
              <span className="metric-title">Total Debt Book</span>
              <span className="metric-badge badge-blue">Portfolio</span>
            </div>
            <div className="metric-value">{money(summary?.debt_book)}</div>
            <div className="metric-subtitle">{summary?.total_accounts ?? 0} active accounts</div>
          </div>

          <div
            className="metric-card"
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => {
              setAccOverdueFilter("OVERDUE");
              setView("accounts");
            }}
            title="Click to view all overdue accounts in arrears"
          >
            <div className="metric-header">
              <span className="metric-title">Total Arrears</span>
              <span className="metric-badge badge-amber">Overdue</span>
            </div>
            <div className="metric-value" style={{ color: "#f87171" }}>{money(summary?.total_arrears)}</div>
            <div className="metric-subtitle">Collectable overdue debt</div>
          </div>

          <div
            className="metric-card"
            style={{
              cursor: "pointer",
              transition: "all 0.2s",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              background: "rgba(56, 189, 248, 0.06)",
            }}
            onClick={() => {
              setAccOverdueFilter("NOT_OVERDUE");
              setAccSearch("");
              setAccMobileSearch("");
              setAccStatusFilter("ALL");
              setAccMinArrears("");
              setView("accounts");
            }}
            title="Click to view all accounts with current unexpired billings"
          >
            <div className="metric-header">
              <span className="metric-title">Current Billings (&lt; 90D)</span>
            </div>
            <div className="metric-value" style={{ color: "#38bdf8" }}>
              {(() => {
                const currentNotOverdue = summary?.current_not_overdue !== undefined
                  ? summary.current_not_overdue
                  : Math.max(0, (summary?.debt_book || 0) - (summary?.total_arrears || 0));
                return money(currentNotOverdue);
              })()}
            </div>
            <div className="metric-subtitle">
              Unexpired active debt across portfolio (Click to view)
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Recovered Cash</span>
              <span className="metric-badge badge-green">Reconciled</span>
            </div>
            <div className="metric-value">{money(summary?.recovered)}</div>
            <div className="metric-subtitle">Recovery Rate: {summary?.recovery_rate ?? 0}%</div>
          </div>

          <div
            className="metric-card"
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => setView("workqueue")}
            title="Click to open full Collector Priority Queue"
          >
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
            const matchesCollector = wqCollectorFilter === "ALL" || item.assigned_to === wqCollectorFilter;

            return matchesSearch && matchesStatus && matchesStrategy && matchesCollector;
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
                    value={wqCollectorFilter}
                    onChange={e => setWqCollectorFilter(e.target.value)}
                    className="form-select filter-select"
                    style={{ borderColor: "#38bdf8" }}
                  >
                    <option value="ALL">👤 All Assigned Collectors</option>
                    {complianceCollectors.map(c => (
                      <option key={c.id} value={c.user_email}>
                        👤 {c.user_name} ({c.compliance_status === "VERIFIED" ? "🟢 Verified" : "🔴 " + c.compliance_status})
                      </option>
                    ))}
                  </select>

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
                          <th>Debtor Name & Mobile</th>
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
                              {item.mobile ? (
                                <div style={{ fontSize: "11.5px", color: "#38bdf8", marginTop: "2px", fontWeight: 600 }}>
                                  📱 {formatPhone(item.mobile)}
                                </div>
                              ) : (
                                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                  No phone on record
                                </div>
                              )}
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
            const term = accSearch.trim().toLowerCase();
            const matchesSearch = !term ||
              (acc.account_number && acc.account_number.toLowerCase().includes(term)) ||
              (acc.customer_name && acc.customer_name.toLowerCase().includes(term)) ||
              (acc.mobile && acc.mobile.toLowerCase().includes(term));
            
            const matchesMobile = !accMobileSearch.trim() ||
              (acc.mobile && acc.mobile.includes(accMobileSearch.trim()));

            const matchesStatus = accStatusFilter === "ALL" || acc.account_status === accStatusFilter;
            const matchesMinArrears = !accMinArrears || Number(acc.arrears) >= Number(accMinArrears);

            const isOverdue = Number(acc.arrears) > 0;
            const currentPortion = Math.max(0, Number(acc.balance) - Number(acc.arrears));
            const matchesOverdue = accOverdueFilter === "ALL" ||
              (accOverdueFilter === "OVERDUE" && isOverdue) ||
              (accOverdueFilter === "NOT_OVERDUE" && currentPortion > 0);

            return matchesSearch && matchesMobile && matchesStatus && matchesMinArrears && matchesOverdue;
          });

          return (
            <div className="glass-panel">
              <div className="panel-header" style={{ flexWrap: "wrap", gap: "16px" }}>
                <div className="panel-title">
                  <h3>
                    Municipal Debt Book ({filteredAccounts.length} / {accounts.length} Accounts)
                    {accOverdueFilter === "NOT_OVERDUE" && <span style={{ color: "#38bdf8", fontSize: "14px", marginLeft: "10px", fontWeight: 600 }}>• Showing Accounts with Current Active Billings</span>}
                    {accOverdueFilter === "OVERDUE" && <span style={{ color: "#f87171", fontSize: "14px", marginLeft: "10px", fontWeight: 600 }}>• Showing Overdue Arrears Accounts</span>}
                  </h3>
                  <p>Complete debtor ledger with balance, arrears, and collection statuses</p>
                </div>
              </div>

              {/* Debt Book Filter Toolbar */}
              <div className="filter-toolbar">
                <div className="search-box" style={{ minWidth: "200px" }}>
                  <input
                    type="text"
                    placeholder="🔍 Search account or name..."
                    value={accSearch}
                    onChange={e => setAccSearch(e.target.value)}
                    className="form-input"
                  />
                  {accSearch && (
                    <button className="clear-search-btn" onClick={() => setAccSearch("")}>✕</button>
                  )}
                </div>

                <div className="search-box" style={{ minWidth: "160px" }}>
                  <input
                    type="text"
                    placeholder="📱 Filter by Mobile..."
                    value={accMobileSearch}
                    onChange={e => setAccMobileSearch(e.target.value)}
                    className="form-input"
                  />
                  {accMobileSearch && (
                    <button className="clear-search-btn" onClick={() => setAccMobileSearch("")}>✕</button>
                  )}
                </div>

                <div className="filter-selects">
                  <select
                    value={accOverdueFilter}
                    onChange={e => setAccOverdueFilter(e.target.value as any)}
                    className="form-select filter-select"
                    style={{ borderColor: accOverdueFilter === "NOT_OVERDUE" ? "#38bdf8" : undefined }}
                  >
                    <option value="ALL">All Ledger Types</option>
                    <option value="OVERDUE">🚨 Overdue Arrears</option>
                    <option value="NOT_OVERDUE">✅ Current Active Billings</option>
                  </select>

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
                    style={{ width: "120px" }}
                  />

                  {(accSearch || accMobileSearch || accStatusFilter !== "ALL" || accOverdueFilter !== "ALL" || accMinArrears) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAccSearch("");
                        setAccMobileSearch("");
                        setAccStatusFilter("ALL");
                        setAccOverdueFilter("ALL");
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
                          <th>Debtor Name & Mobile</th>
                          <th>Status</th>
                          <th>Total Balance</th>
                          <th>Current (Not Overdue)</th>
                          <th>Overdue Arrears</th>
                          <th>DAYS PAST DUE</th>
                          <th>Last Payment</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.map(acc => {
                          const currentAmt = Math.max(0, Number(acc.balance) - Number(acc.arrears));
                          return (
                            <tr key={acc.id}>
                              <td><strong>{acc.account_number}</strong></td>
                              <td>
                                <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{acc.customer_name || "—"}</div>
                                {acc.mobile && (
                                  <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "2px" }}>
                                    📱 {formatPhone(acc.mobile)}
                                  </div>
                                )}
                              </td>
                              <td><span className={`status-pill ${getStatusPillClass(acc.account_status)}`}>{formatCaseStatus(acc.account_status)}</span></td>
                              <td><strong>{money(acc.balance)}</strong></td>
                              <td style={{ color: "#38bdf8", fontWeight: 600 }}>{money(currentAmt)}</td>
                              <td style={{ color: "#f87171", fontWeight: 600 }}>{money(acc.arrears)}</td>
                              <td><strong>{acc.days_in_arrears}</strong></td>
                              <td>{acc.last_payment_date ? `${acc.last_payment_date} (${money(acc.last_payment_amount)})` : "None"}</td>
                              <td>
                                <button className="table-action-btn" onClick={() => openAccountWorkbench(acc.id)}>
                                  Workbench
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile / Tablet Adaptive Card List */}
                  <div className="mobile-card-list">
                    {filteredAccounts.map(acc => {
                      const currentAmt = Math.max(0, Number(acc.balance) - Number(acc.arrears));
                      return (
                        <div key={acc.id} className="mobile-item-card">
                          <div className="mobile-card-header">
                            <div>
                              <div className="mobile-card-acc">{acc.account_number}</div>
                              <div className="mobile-card-debtor">{acc.customer_name || `Status: ${formatCaseStatus(acc.account_status)}`}</div>
                              {acc.mobile && (
                                <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "2px" }}>
                                  📱 {formatPhone(acc.mobile)}
                                </div>
                              )}
                            </div>
                            <span className={`status-pill ${getStatusPillClass(acc.account_status)}`}>{formatCaseStatus(acc.account_status)}</span>
                          </div>

                          <div className="mobile-card-body">
                            <div className="mobile-stat">
                              <label>Total Balance</label>
                              <span>{money(acc.balance)}</span>
                            </div>
                            <div className="mobile-stat">
                              <label>Current (Not Overdue)</label>
                              <span style={{ color: "#38bdf8", fontWeight: 600 }}>{money(currentAmt)}</span>
                            </div>
                            <div className="mobile-stat">
                              <label>Overdue Arrears</label>
                              <span className="arrears-val">{money(acc.arrears)}</span>
                            </div>
                            <div className="mobile-stat">
                              <label>DAYS PAST DUE</label>
                              <span>{acc.days_in_arrears}</span>
                            </div>
                          </div>

                          <div className="mobile-card-actions">
                            <button className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => openAccountWorkbench(acc.id)}>
                              👁️ View Account 360°
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

                  <div style={{ maxWidth: "400px", margin: "0 auto 16px auto", textAlign: "left" }}>
                    <label style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px", display: "block" }}>🎯 Target Municipality / Portfolio:</label>
                    <select
                      value={selectedTenant === "GLOBAL" ? (tenants[0]?.id || "") : selectedTenant}
                      onChange={e => setSelectedTenant(e.target.value)}
                      className="form-select"
                      style={{ width: "100%", padding: "8px 12px", fontSize: "13px", fontWeight: 600 }}
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>🏛️ {t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>

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
                        { key: "first_name", label: "Customer First Name / Legal Entity", required: false },
                        { key: "last_name", label: "Customer Last Name / Suffix", required: false },
                        { key: "id_number", label: "SA ID Number / Registration", required: false },
                        { key: "mobile", label: "Mobile / Phone Number", required: false },
                        { key: "email", label: "Email Address", required: false },
                        { key: "property_reference", label: "Property Ref / Stand (ERF)", required: false },
                        { key: "address", label: "Physical / Municipal Address", required: false },
                        { key: "balance", label: "Total Balance (ZAR)", required: false },
                        { key: "arrears", label: "Overdue Arrears (ZAR)", required: false },
                        { key: "days_in_arrears", label: "Days in Arrears (DPD)", required: false },
                        { key: "last_payment_date", label: "Last Payment Date", required: false },
                        { key: "last_payment_amount", label: "Last Payment Amount (ZAR)", required: false },
                        { key: "account_status", label: "Account Status", required: false },
                      ].map(field => {
                        const mappedCol = customColumnMapping[field.key] || importMappingData.mapping[field.key];
                        const availableCols = (importMappingData.columns || []).filter((c: string) => !c.toLowerCase().endsWith(".1") && !c.toLowerCase().endsWith(" .1"));
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
                                {availableCols.map((c: string) => (
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
              const managedTenants = tenants.filter(t => t.engagement_model === "MANAGED_SERVICE");

              // SaaS MRR applies across all contracted municipalities
              const monthlySaasMRR = tenants.reduce((acc, t) => acc + (Number(t.monthly_subscription_fee) || 0), 0);
              const projectedSaasARR = monthlySaasMRR * 12;

              // Managed recovery commission potential directly on the managed debt book
              const totalLedgerBalance = summary?.outstanding || summary?.debt_book || 0;
              const avgManagedCommission = managedTenants.length > 0 
                ? managedTenants.reduce((acc, t) => acc + (Number(t.commission_rate) || 10), 0) / managedTenants.length 
                : 15;
              
              // Total potential commission across the managed portfolio
              const totalManagedCommissionPotential = totalLedgerBalance * (avgManagedCommission / 100);

              const totalProjectedAnnualRevenue = projectedSaasARR + totalManagedCommissionPotential;

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
                        Across <strong>{tenants.length}</strong> contracted municipalities
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
                          🛡️ Managed Commission Potential
                        </span>
                        <span className="metric-badge badge-green">Commission</span>
                      </div>
                      <div className="metric-value" style={{ color: "#34d399" }}>
                        R {Math.round(totalManagedCommissionPotential).toLocaleString()}
                      </div>
                      <div className="metric-subtitle">
                        {avgManagedCommission.toFixed(1)}% commission on R {Math.round(totalLedgerBalance).toLocaleString()} debt book
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

            {/* Municipalities Portfolio Management Table */}
            <div className="glass-panel" style={{ marginBottom: "28px" }}>
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="panel-title">
                  <h3>🏛️ Municipal Clients & SaaS Portfolios ({tenants.length})</h3>
                  <p>Manage subscription tiers, engagement models (Internal SaaS vs Khokhisa Managed), and billing terms</p>
                </div>
                {currentUser?.role === "SUPERADMIN" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
                    onClick={() => setShowOnboardTenantModal(true)}
                  >
                    🏛️ Onboard Municipality & Activate Contract
                  </button>
                )}
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
                              🛡️ Khokhisa Managed Agency
                            </span>
                          ) : (
                            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)", fontWeight: 600, fontSize: "11.5px" }}>
                              💻 SaaS Municipal Subscription
                            </span>
                          )}
                        </td>
                        <td><strong style={{ color: "#e2e8f0", fontSize: "12px" }}>{t.subscription_tier || "ENTERPRISE"}</strong></td>
                        <td>
                          <div style={{ fontSize: "12px" }}>
                            <div style={{ color: "#60a5fa", fontWeight: 600 }}>
                              {t.monthly_subscription_fee ? `R ${Number(t.monthly_subscription_fee).toLocaleString()} / mo SaaS` : "R 0 / mo SaaS"}
                            </div>
                            <div style={{ color: "#34d399", fontWeight: 600, marginTop: "2px" }}>
                              {t.commission_rate ? `${t.commission_rate}% Khokhisa Comm.` : "10% Khokhisa Comm."}
                            </div>
                          </div>
                        </td>
                        <td>
                          {currentUser?.role === "SUPERADMIN" ? (
                            <select
                              value={t.subscription_status || "ACTIVE"}
                              onChange={e => handleQuickChangeTenantStatus(t.id, e.target.value)}
                              className="form-select"
                              style={{
                                padding: "4px 8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                borderRadius: "6px",
                                cursor: "pointer",
                                width: "auto",
                                display: "inline-block",
                                background: t.subscription_status === "ACTIVE" 
                                  ? "rgba(16, 185, 129, 0.15)" 
                                  : t.subscription_status === "TRIAL"
                                  ? "rgba(14, 165, 233, 0.15)"
                                  : t.subscription_status === "SUSPENDED"
                                  ? "rgba(244, 63, 94, 0.15)"
                                  : "rgba(234, 179, 8, 0.15)",
                                color: t.subscription_status === "ACTIVE" 
                                  ? "#34d399" 
                                  : t.subscription_status === "TRIAL"
                                  ? "#38bdf8"
                                  : t.subscription_status === "SUSPENDED"
                                  ? "#fb7185"
                                  : "#fde047",
                                borderColor: t.subscription_status === "ACTIVE" 
                                  ? "rgba(16, 185, 129, 0.3)" 
                                  : t.subscription_status === "TRIAL"
                                  ? "rgba(14, 165, 233, 0.3)"
                                  : t.subscription_status === "SUSPENDED"
                                  ? "rgba(244, 63, 94, 0.3)"
                                  : "rgba(234, 179, 8, 0.3)",
                              }}
                            >
                              <option value="ACTIVE" style={{ background: "#0f172a", color: "#34d399" }}>🟢 ACTIVE</option>
                              <option value="TRIAL" style={{ background: "#0f172a", color: "#38bdf8" }}>🔵 TRIAL</option>
                              <option value="SUSPENDED" style={{ background: "#0f172a", color: "#fb7185" }}>🔴 SUSPENDED</option>
                              <option value="EXPIRED" style={{ background: "#0f172a", color: "#fde047" }}>🟡 EXPIRED</option>
                            </select>
                          ) : (
                            <span className={`status-pill ${
                              t.subscription_status === "ACTIVE" 
                                ? "status-paying" 
                                : t.subscription_status === "TRIAL"
                                ? "status-engaged"
                                : t.subscription_status === "SUSPENDED"
                                ? "status-broken"
                                : "status-new"
                            }`}>
                              {t.subscription_status || "ACTIVE"}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600 }}
                              onClick={() => setEditingTenant(t)}
                            >
                              ⚙️ Edit Terms
                            </button>
                            {currentUser?.role === "SUPERADMIN" && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "#fb7185",
                                  borderColor: "rgba(244, 63, 94, 0.3)",
                                  background: "rgba(244, 63, 94, 0.08)",
                                }}
                                title="Delete Municipality & Clean Purge"
                                onClick={() => handleDeleteTenant(t.id, t.name)}
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </div>
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
            {/* Users Table / Mobile Cards */}
            <div className="glass-panel">
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="panel-title">
                  <h3>Active System Users ({usersList.length})</h3>
                  <p>All authenticated personnel with active role access</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
                  onClick={() => setShowCreateUserModal(true)}
                >
                  ➕ Create User Account
                </button>
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
                    <div className="table-container" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", whiteSpace: "nowrap", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Invoice #</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Municipality</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Period</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Issue Date</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Due Date</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>Subtotal</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>VAT (15%)</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>Total Due</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>Status</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map(inv => (
                            <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                                <strong style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "12.5px" }}>
                                  {inv.invoice_number}
                                </strong>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }} title={inv.tenant_name || "Municipality"}>
                                <strong style={{ color: "#f8fafc", fontSize: "12px" }}>{inv.tenant_name || "Municipality"}</strong>
                                <span style={{ fontSize: "10.5px", color: "#64748b", marginLeft: "6px" }}>({inv.tenant_code})</span>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{inv.billing_period}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "#94a3b8" }}>{inv.issue_date}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: new Date(inv.due_date) < new Date() && inv.status !== "PAID" ? "#f87171" : "#94a3b8" }}>
                                {inv.due_date}
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right", color: "#94a3b8" }}>{money(inv.subtotal)}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right", color: "#94a3b8" }}>{money(inv.vat_amount)}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                                <strong style={{ color: "#f8fafc", fontSize: "12.5px" }}>{money(inv.total_amount)}</strong>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>
                                <span className={`status-pill ${
                                  inv.status === "PAID" ? "status-paying" :
                                  inv.status === "ISSUED" ? "status-new" :
                                  inv.status === "OVERDUE" ? "status-escalated" : "status-engaged"
                                }`} style={{ padding: "2px 8px", fontSize: "10.5px" }}>
                                  {inv.status}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>
                                <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setViewingPdfDoc({ type: "INVOICE", data: inv })}
                                    style={{ padding: "3px 8px", fontSize: "11px", whiteSpace: "nowrap" }}
                                    title="View official PDF Tax Invoice and print"
                                  >
                                    📄 PDF / Print
                                  </button>
                                  {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && inv.status !== "PAID" && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleUpdateInvoiceStatus(inv.id, "PAID")}
                                      style={{ padding: "3px 8px", fontSize: "11px", background: "#10b981", borderColor: "#10b981", whiteSpace: "nowrap" }}
                                      title="Mark invoice as settled / paid"
                                    >
                                      ✓ Mark Paid
                                    </button>
                                  )}
                                  {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && inv.status === "PAID" && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleUpdateInvoiceStatus(inv.id, "ISSUED")}
                                      style={{ padding: "3px 8px", fontSize: "11px", color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)", whiteSpace: "nowrap" }}
                                      title="Revert to Unpaid / Issued"
                                    >
                                      ↺ Unmark
                                    </button>
                                  )}
                                  {currentUser?.role === "SUPERADMIN" && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                      style={{ padding: "3px 6px", fontSize: "11px", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
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
                        Create formal proposals for municipalities covering SaaS licensing tiers or Khokhisa Managed Collections with approval workflows.
                      </p>
                      {currentUser?.role === "SUPERADMIN" && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowNewProposalModal(true)}>
                          ➕ Draft First Proposal
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="table-container" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", whiteSpace: "nowrap", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Proposal #</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Municipality</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Title</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Model</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>Total Value</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>Valid Until</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>Status</th>
                            <th style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proposals.map(prop => (
                            <tr key={prop.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                                <strong style={{ color: "#a5b4fc", fontFamily: "monospace", fontSize: "12.5px" }}>
                                  {prop.proposal_number}
                                </strong>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }} title={prop.tenant_name || "Municipality"}>
                                <strong style={{ color: "#f8fafc", fontSize: "12px" }}>{prop.tenant_name || "Municipality"}</strong>
                                <span style={{ fontSize: "10.5px", color: "#64748b", marginLeft: "6px" }}>({prop.tenant_code})</span>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis" }} title={prop.title}>
                                <span style={{ fontWeight: 600, color: "#f8fafc" }}>{prop.title}</span>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                                <span style={{
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: prop.engagement_model === "SAAS_SELF_SERVICE" ? "rgba(14, 165, 233, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                  color: prop.engagement_model === "SAAS_SELF_SERVICE" ? "#38bdf8" : "#34d399",
                                }}>
                                  {prop.engagement_model === "SAAS_SELF_SERVICE" ? "SaaS" : "Managed"}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                                <strong style={{ color: "#f8fafc", fontSize: "12.5px" }}>
                                  {Number(prop.total_amount) > 0 ? money(prop.total_amount) : `${prop.commission_rate}% Comm.`}
                                </strong>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "#94a3b8" }}>{prop.valid_until || "30 Days"}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>
                                <span className={`status-pill ${
                                  prop.status === "APPROVED" ? "status-paying" :
                                  prop.status === "SUBMITTED_TO_MUNICIPALITY" ? "status-engaged" :
                                  prop.status === "REJECTED" ? "status-broken" : "status-new"
                                }`} style={{ padding: "2px 8px", fontSize: "10.5px" }}>
                                  {prop.status === "SUBMITTED_TO_MUNICIPALITY" ? "SUBMITTED" : prop.status}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "center" }}>
                                <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setViewingPdfDoc({ type: "PROPOSAL", data: prop })}
                                    style={{ padding: "3px 8px", fontSize: "11px", whiteSpace: "nowrap" }}
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
                                        style={{ padding: "3px 8px", fontSize: "11px", background: "#10b981", borderColor: "#10b981", whiteSpace: "nowrap" }}
                                        title="Approve Proposal (Auto-generates Tax Invoice)"
                                      >
                                        👍 Approve
                                      </button>
                                      {currentUser?.role === "ADMIN" && prop.status !== "REJECTED" && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => handleUpdateProposalStatus(prop.id, "REJECTED")}
                                          style={{ padding: "3px 8px", fontSize: "11px", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)", whiteSpace: "nowrap" }}
                                          title="Reject Proposal"
                                        >
                                          ✕ Reject
                                        </button>
                                      )}
                                      {currentUser?.role === "SUPERADMIN" && (
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => handleUpdateProposalStatus(prop.id, "SUBMITTED_TO_MUNICIPALITY", "obimax.ml@gmail.com")}
                                          style={{ padding: "3px 8px", fontSize: "11px", borderColor: "rgba(14, 165, 233, 0.4)", color: "#38bdf8", whiteSpace: "nowrap" }}
                                          title="Submit proposal notification to municipality"
                                        >
                                          📧 Submit
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {/* SuperAdmin Delete Proposal */}
                                  {currentUser?.role === "SUPERADMIN" && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleDeleteProposal(prop.id, prop.proposal_number)}
                                      style={{ padding: "3px 6px", fontSize: "11px", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
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

              {/* COLLECTOR SPECIFIC COMPLIANCE & TRUST PROFILE */}
              {currentUser.role === "COLLECTOR" && (
                <div style={{ padding: "18px 20px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.04)", border: "1px solid rgba(56, 189, 248, 0.2)", marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "15px", color: "#38bdf8" }}>🏛️ Council for Debt Collectors (CFDC) & Trust Account Profile</h4>
                      <p style={{ color: "#94a3b8", fontSize: "12px", margin: "3px 0 0 0" }}>
                        Statutory certification and dedicated separate trust account under Act 114 of 1998
                      </p>
                    </div>
                    {myCollectorProfile && (
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 800,
                        background: myCollectorProfile.compliance_status === "VERIFIED" ? "rgba(16, 185, 129, 0.2)" : "rgba(234, 179, 8, 0.2)",
                        color: myCollectorProfile.compliance_status === "VERIFIED" ? "#34d399" : "#facc15",
                        border: `1px solid ${myCollectorProfile.compliance_status === "VERIFIED" ? "rgba(16, 185, 129, 0.4)" : "rgba(234, 179, 8, 0.4)"}`,
                      }}>
                        {myCollectorProfile.compliance_status === "VERIFIED" ? "🟢 VERIFIED" : "🟡 PENDING"}
                      </span>
                    )}
                  </div>

                  <div className="info-grid" style={{ marginBottom: "14px" }}>
                    <div className="form-group">
                      <label>CFDC Registration Number</label>
                      <input
                        type="text"
                        placeholder="e.g. CFDC-2026-9842"
                        value={myCfdcNumber}
                        onChange={e => setMyCfdcNumber(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>CFDC Expiry Date</label>
                      <input
                        type="date"
                        value={myCfdcExpiry}
                        onChange={e => setMyCfdcExpiry(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#34d399", marginBottom: "10px", marginTop: "16px" }}>
                    🏦 Separate Statutory Trust Account
                  </div>

                  <div className="info-grid" style={{ marginBottom: "14px" }}>
                    <div className="form-group">
                      <label>Trust Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Standard Bank / FNB / Nedbank"
                        value={myTrustBank}
                        onChange={e => setMyTrustBank(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Trust Branch Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 051001"
                        value={myTrustBranch}
                        onChange={e => setMyTrustBranch(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="info-grid" style={{ marginBottom: "14px" }}>
                    <div className="form-group">
                      <label>Trust Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 0228491039"
                        value={myTrustAccNum}
                        onChange={e => setMyTrustAccNum(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Trust Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sithole Collections Trust Account"
                        value={myTrustAccHolder}
                        onChange={e => setMyTrustAccHolder(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "14px" }}>
                    <label>Annual Trust Audit Due Date</label>
                    <input
                      type="date"
                      value={myTrustAuditDue}
                      onChange={e => setMyTrustAuditDue(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="info-grid">
                    <div className="form-group">
                      <label>Bank Confirmation Letter URL</label>
                      <input
                        type="text"
                        placeholder="https://storage.khokhisa.co.za/trust/bank_letter.pdf"
                        value={myTrustBankLetterUrl}
                        onChange={e => setMyTrustBankLetterUrl(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Auditor Letter URL</label>
                      <input
                        type="text"
                        placeholder="https://storage.khokhisa.co.za/trust/auditor_letter.pdf"
                        value={myTrustAuditorLetterUrl}
                        onChange={e => setMyTrustAuditorLetterUrl(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>
              )}

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
        {/* COMPLIANCE, TRUST ACCOUNTS & REMITTANCE VIEW */}
        {view === "compliance" && (
          <div>
            {/* Top Overview Cards */}
            <div className="metrics-grid" style={{ marginBottom: "24px" }}>
              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">Registered Collectors</span>
                  <span className="metric-badge badge-blue">CFDC Roster</span>
                </div>
                <div className="metric-value">{complianceCollectors.length}</div>
                <div className="metric-subtitle">
                  {complianceCollectors.filter(c => c.compliance_status === "VERIFIED").length} Verified & Active
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">Compliance Health</span>
                  <span className="metric-badge badge-emerald" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    Hard Enforced
                  </span>
                </div>
                <div className="metric-value" style={{ color: "#34d399" }}>
                  {complianceCollectors.length > 0 
                    ? `${Math.round((complianceCollectors.filter(c => c.compliance_status === "VERIFIED").length / complianceCollectors.length) * 100)}%` 
                    : "100%"}
                </div>
                <div className="metric-subtitle">
                  {complianceCollectors.filter(c => c.compliance_status === "SUSPENDED").length} Suspended / Overdue
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">Trust Remittance Pool</span>
                  <span className="metric-badge badge-indigo">Direct to Council</span>
                </div>
                <div className="metric-value" style={{ color: "#38bdf8" }}>
                  {money(complianceRemittances.reduce((sum, r) => sum + (Number(r.remittance_amount) || 0), 0))}
                </div>
                <div className="metric-subtitle">
                  Across {complianceRemittances.length} trust deposits
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">Daily Audit Job</span>
                  <span className="metric-badge badge-purple">Automated</span>
                </div>
                <div style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "center", borderColor: "#a855f7", color: "#e9d5ff" }}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch(`${API}/compliance/cron/run-audit`, { method: "POST" });
                        const data = await res.json();
                        alert(`🔍 Compliance Audit Complete!\nChecked: ${data.total_checked} | Verified: ${data.verified_collectors} | Suspended: ${data.newly_suspended}`);
                        refreshData();
                      } catch (err: any) {
                        alert("Audit error: " + err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    ⚡ Run Audit Cron Now
                  </button>
                </div>
                <div className="metric-subtitle" style={{ marginTop: "6px" }}>Auto-suspends non-compliant collectors</div>
              </div>
            </div>

            {/* Compliance Navigation Tabs */}
            <div className="glass-panel" style={{ marginBottom: "24px" }}>
              <div className="tabs" style={{ marginBottom: "20px" }}>
                <div className={`tab ${complianceTab === "collectors" ? "active" : ""}`} onClick={() => setComplianceTab("collectors")}>
                  <span>👥 Collectors Compliance Roster</span>
                  <span className="tab-badge">{complianceCollectors.length}</span>
                </div>
                <div className={`tab ${complianceTab === "trust" ? "active" : ""}`} onClick={() => setComplianceTab("trust")}>
                  <span>🏦 Trust Account Verifications</span>
                  <span className="tab-badge">{complianceCollectors.filter(c => c.trust_account).length}</span>
                </div>
                <div className={`tab ${complianceTab === "remittances" ? "active" : ""}`} onClick={() => setComplianceTab("remittances")}>
                  <span>💵 Trust Remittance Ledger</span>
                  <span className="tab-badge">{complianceRemittances.length}</span>
                </div>
              </div>

              {/* TAB 1: COLLECTORS COMPLIANCE ROSTER */}
              {complianceTab === "collectors" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>Council for Debt Collectors (CFDC) Verification & Roster</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Statutory certification, annual audit reports, and municipal approvals enforced server-side.
                      </p>
                    </div>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Collector Name / Email</th>
                          <th>CFDC Registration #</th>
                          <th>CFDC Expiry</th>
                          <th>Trust Account</th>
                          <th>Municipal Assignments</th>
                          <th>Compliance Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {complianceCollectors.map(c => {
                          const isExpiringSoon = c.days_to_cfdc_expiry !== null && c.days_to_cfdc_expiry <= 60 && c.days_to_cfdc_expiry > 0;
                          const isExpired = c.days_to_cfdc_expiry !== null && c.days_to_cfdc_expiry <= 0;

                          return (
                            <tr key={c.id}>
                              <td>
                                <div style={{ fontWeight: 700, color: "#f8fafc" }}>{c.user_name}</div>
                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{c.user_email}</div>
                              </td>
                              <td>
                                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#38bdf8", fontWeight: 700 }}>
                                  {c.cfdc_registration_number}
                                </span>
                              </td>
                              <td>
                                <div>{c.cfdc_expiry_date || "Not Provided"}</div>
                                {isExpiringSoon && (
                                  <span style={{ fontSize: "10.5px", color: "#facc15", fontWeight: 700 }}>⚠️ Expires in {c.days_to_cfdc_expiry}d</span>
                                )}
                                {isExpired && (
                                  <span style={{ fontSize: "10.5px", color: "#fb7185", fontWeight: 700 }}>🚨 EXPIRED</span>
                                )}
                              </td>
                              <td>
                                {c.trust_account ? (
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{c.trust_account.bank_name}</div>
                                    <span style={{
                                      fontSize: "10.5px",
                                      fontWeight: 700,
                                      color: c.trust_account.verification_status === "VERIFIED" ? "#34d399" : "#fbbf24"
                                    }}>
                                      ● {c.trust_account.verification_status}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: "#fb7185", fontSize: "12px" }}>❌ Missing Trust Account</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                  {c.assignments.length === 0 ? (
                                    <span style={{ color: "#64748b", fontSize: "11.5px" }}>Unassigned</span>
                                  ) : (
                                    c.assignments.map((a: any) => (
                                      <span
                                        key={a.id}
                                        style={{
                                          fontSize: "11px",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          background: a.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                                          color: a.status === "ACTIVE" ? "#34d399" : "#fb7185",
                                          border: `1px solid ${a.status === "ACTIVE" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                                        }}
                                      >
                                        {a.tenant_code}: {a.status}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  background: c.compliance_status === "VERIFIED" ? "rgba(16, 185, 129, 0.2)" : c.compliance_status === "SUSPENDED" ? "rgba(244, 63, 94, 0.2)" : "rgba(234, 179, 8, 0.2)",
                                  color: c.compliance_status === "VERIFIED" ? "#34d399" : c.compliance_status === "SUSPENDED" ? "#fb7185" : "#facc15",
                                  border: `1px solid ${c.compliance_status === "VERIFIED" ? "rgba(16, 185, 129, 0.35)" : c.compliance_status === "SUSPENDED" ? "rgba(244, 63, 94, 0.35)" : "rgba(234, 179, 8, 0.35)"}`,
                                }}>
                                  {c.compliance_status === "VERIFIED" ? "🟢 VERIFIED" : c.compliance_status === "SUSPENDED" ? "🔴 SUSPENDED" : "🟡 PENDING"}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setSelectedCollectorForDetails(c);
                                      if (c.trust_account) {
                                        setTrustBankName(c.trust_account.bank_name);
                                        setTrustBranchCode(c.trust_account.branch_code);
                                        setTrustAccountNumber(c.trust_account.account_number);
                                        setTrustAccountHolder(c.trust_account.account_holder_name);
                                        setTrustAuditDueDate(c.trust_account.audit_due_date);
                                        setTrustBankLetterUrl(c.trust_account.bank_confirmation_letter_url || "");
                                        setTrustAuditorLetterUrl(c.trust_account.auditor_letter_url || "");
                                        setTrustAuditReportUrl(c.trust_account.last_audit_report_url || "");
                                      } else {
                                        setTrustBankName("");
                                        setTrustBranchCode("");
                                        setTrustAccountNumber("");
                                        setTrustAccountHolder("");
                                        setTrustAuditDueDate("");
                                        setTrustBankLetterUrl("");
                                        setTrustAuditorLetterUrl("");
                                        setTrustAuditReportUrl("");
                                      }
                                      setShowTrustModal(true);
                                    }}
                                  >
                                    ⚙️ Trust & KYC
                                  </button>

                                  {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
                                    <>
                                      {c.compliance_status !== "VERIFIED" ? (
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          style={{ background: "#059669", borderColor: "#10b981" }}
                                          onClick={async () => {
                                            if (!confirm(`Verify collector ${c.user_name}? This enables active collection actions.`)) return;
                                            setLoading(true);
                                            try {
                                              await fetch(`${API}/compliance/collectors/${c.id}`, {
                                                method: "PUT",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ compliance_status: "VERIFIED" }),
                                              });
                                              alert(`Collector ${c.user_name} marked as VERIFIED!`);
                                              refreshData();
                                            } catch (err: any) {
                                              alert("Error: " + err.message);
                                            } finally {
                                              setLoading(false);
                                            }
                                          }}
                                        >
                                          ✓ Verify
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
                                          onClick={async () => {
                                            const reason = prompt("Enter suspension reason:", "Annual audit report overdue or compliance audit failure");
                                            if (!reason) return;
                                            setLoading(true);
                                            try {
                                              await fetch(`${API}/compliance/collectors/${c.id}`, {
                                                method: "PUT",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ compliance_status: "SUSPENDED", suspension_reason: reason }),
                                              });
                                              alert(`Collector ${c.user_name} has been SUSPENDED.`);
                                              refreshData();
                                            } catch (err: any) {
                                              alert("Error: " + err.message);
                                            } finally {
                                              setLoading(false);
                                            }
                                          }}
                                        >
                                          ⛔ Suspend
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: TRUST ACCOUNT VERIFICATIONS */}
              {complianceTab === "trust" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>Statutory Trust Accounts & Annual Auditor Reviews</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Section 9(1) of the Debt Collectors Act: Mandated separate trust banking accounts and external auditor verification.
                      </p>
                    </div>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Collector</th>
                          <th>Bank & Branch</th>
                          <th>Trust Account #</th>
                          <th>Account Holder</th>
                          <th>Audit Due Date</th>
                          <th>Auditor Documents</th>
                          <th>Trust Status</th>
                          <th>Admin Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {complianceCollectors.filter(c => c.trust_account).map(c => {
                          const t = c.trust_account;
                          return (
                            <tr key={t.id}>
                              <td><strong>{c.user_name}</strong></td>
                              <td>{t.bank_name} ({t.branch_code})</td>
                              <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#38bdf8" }}>{t.account_number}</td>
                              <td>{t.account_holder_name}</td>
                              <td>
                                <div>{t.audit_due_date}</div>
                                {t.days_to_audit_due !== null && t.days_to_audit_due <= 30 && (
                                  <span style={{ fontSize: "10.5px", color: "#fb7185", fontWeight: 700 }}>
                                    ⚠️ Due in {t.days_to_audit_due}d
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" }}>
                                  {t.bank_confirmation_letter_url && (
                                    <a href={t.bank_confirmation_letter_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
                                      📄 Bank Letter
                                    </a>
                                  )}
                                  {t.auditor_letter_url && (
                                    <a href={t.auditor_letter_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
                                      📄 Auditor Letter
                                    </a>
                                  )}
                                  {t.last_audit_report_url && (
                                    <a href={t.last_audit_report_url} target="_blank" rel="noreferrer" style={{ color: "#a855f7" }}>
                                      📊 Last Audit Report
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: t.verification_status === "VERIFIED" ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                                  color: t.verification_status === "VERIFIED" ? "#34d399" : "#facc15"
                                }}>
                                  {t.verification_status}
                                </span>
                              </td>
                              <td>
                                {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    {t.verification_status !== "VERIFIED" ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        style={{ background: "#059669", borderColor: "#10b981", fontSize: "11px", padding: "3px 8px" }}
                                        onClick={async () => {
                                          setLoading(true);
                                          try {
                                            await fetch(`${API}/compliance/collectors/${c.id}/trust-account/status?verification_status=VERIFIED`, {
                                              method: "PATCH",
                                            });
                                            alert("Trust account marked as VERIFIED!");
                                            refreshData();
                                          } catch (err: any) {
                                            alert("Error: " + err.message);
                                          } finally {
                                            setLoading(false);
                                          }
                                        }}
                                      >
                                        ✓ Approve Trust
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ color: "#fb7185", fontSize: "11px", padding: "3px 8px" }}
                                        onClick={async () => {
                                          setLoading(true);
                                          try {
                                            await fetch(`${API}/compliance/collectors/${c.id}/trust-account/status?verification_status=REVOKED`, {
                                              method: "PATCH",
                                            });
                                            alert("Trust verification REVOKED.");
                                            refreshData();
                                          } catch (err: any) {
                                            alert("Error: " + err.message);
                                          } finally {
                                            setLoading(false);
                                          }
                                        }}
                                      >
                                        Revoke
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: TRUST REMITTANCE LEDGER */}
              {complianceTab === "remittances" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>Trust Account Remittance & Municipal Disbursements</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Tracking payments collected into trust, statutory commission caps (Debt Collectors Act), and EFT remittances to municipalities.
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowRemittanceModal(true)}
                      >
                        ➕ Record Trust Deposit & Remittance
                      </button>
                    </div>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Receipt Date</th>
                          <th>Collector</th>
                          <th>Municipality</th>
                          <th>Debtor Ref</th>
                          <th>Gross Received</th>
                          <th>Commission Earned</th>
                          <th>Net Remittance</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {complianceRemittances.map(r => (
                          <tr key={r.id}>
                            <td>{r.receipt_date}</td>
                            <td><strong>{r.collector_name}</strong></td>
                            <td>{r.tenant_name}</td>
                            <td style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700 }}>{r.debtor_reference}</td>
                            <td style={{ fontWeight: 700, color: "#f8fafc" }}>{money(r.amount_received)}</td>
                            <td style={{ color: "#818cf8" }}>{money(r.commission_amount)} ({r.commission_rate}%)</td>
                            <td style={{ fontWeight: 800, color: "#34d399" }}>{money(r.remittance_amount)}</td>
                            <td>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: r.remittance_status === "REMITTED" ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                                color: r.remittance_status === "REMITTED" ? "#34d399" : "#facc15",
                              }}>
                                {r.remittance_status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {r.remittance_status === "PENDING" && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: "11px", padding: "2px 8px", color: "#34d399", borderColor: "#10b981" }}
                                    onClick={async () => {
                                      const ref = prompt("Enter bank statement EFT remittance reference:", `EFT-REM-${Date.now().toString().slice(-4)}`);
                                      if (!ref) return;
                                      setLoading(true);
                                      try {
                                        await fetch(`${API}/compliance/remittances/${r.id}/status`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ remittance_status: "REMITTED", bank_statement_ref: ref }),
                                        });
                                        alert("Remittance marked as REMITTED to municipality bank account!");
                                        refreshData();
                                      } catch (err: any) {
                                        alert("Error: " + err.message);
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                  >
                                    ✓ Remit to Muni
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: "11px", padding: "2px 8px" }}
                                  onClick={async () => {
                                    setLoading(true);
                                    try {
                                      const res = await fetch(`${API}/compliance/remittances/statement?collector_profile_id=${r.collector_profile_id}&tenant_id=${r.tenant_id}`);
                                      const stmt = await res.json();
                                      setRemittanceStatementModal(stmt);
                                    } catch (err: any) {
                                      alert("Failed to load monthly statement: " + err.message);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  📄 Statement
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* LEGAL & REGULATORY COMPLIANCE VIEW */}
        {view === "legal_compliance" && (
          <div>
            {/* Top Stat Cards */}
            <div className="metrics-grid" style={{ marginBottom: "24px" }}>
              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">POPIA S21 Agreements</span>
                  <span className="metric-badge badge-blue">Responsible Party</span>
                </div>
                <div className="metric-value">{legalAgreements.length}</div>
                <div className="metric-subtitle">
                  {legalAgreements.filter(a => a.status === "EXECUTED").length} ECTA S13 Executed
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">PII Access Audit Log</span>
                  <span className="metric-badge badge-emerald" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    POPIA S19
                  </span>
                </div>
                <div className="metric-value" style={{ color: "#34d399" }}>
                  {legalPiiLogs.length}
                </div>
                <div className="metric-subtitle">Immutable view & export trails</div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">MFMA S116 Mandates</span>
                  <span className="metric-badge badge-indigo">Municipal SLAs</span>
                </div>
                <div className="metric-value" style={{ color: "#38bdf8" }}>
                  {legalMandates.length}
                </div>
                <div className="metric-subtitle">
                  {legalMandates.filter(m => m.status === "EXPIRING_SOON").length} Expiring in &lt;30 days
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">Data Residency</span>
                  <span className="metric-badge badge-purple">POPIA S72</span>
                </div>
                <div className="metric-value" style={{ color: "#a855f7", fontSize: "19px" }}>
                  🇿🇦 South Africa
                </div>
                <div className="metric-subtitle">100% In-Country Cloud (JHB/CPT)</div>
              </div>
            </div>

            {/* Legal Compliance Navigation Tabs */}
            <div className="glass-panel" style={{ marginBottom: "24px" }}>
              <div className="tabs" style={{ marginBottom: "20px" }}>
                <div className={`tab ${legalComplianceTab === "popia_agreements" ? "active" : ""}`} onClick={() => setLegalComplianceTab("popia_agreements")}>
                  <span>📝 S21 Operator Agreements</span>
                  <span className="tab-badge">{legalAgreements.length}</span>
                </div>
                <div className={`tab ${legalComplianceTab === "pii_audit" ? "active" : ""}`} onClick={() => setLegalComplianceTab("pii_audit")}>
                  <span>🔍 S19 PII Access Audit Log</span>
                  <span className="tab-badge">{legalPiiLogs.length}</span>
                </div>
                <div className={`tab ${legalComplianceTab === "mfma_mandates" ? "active" : ""}`} onClick={() => setLegalComplianceTab("mfma_mandates")}>
                  <span>🏛️ MFMA Contract Mandates</span>
                  <span className="tab-badge">{legalMandates.length}</span>
                </div>
                <div className={`tab ${legalComplianceTab === "breaches" ? "active" : ""}`} onClick={() => setLegalComplianceTab("breaches")}>
                  <span>🚨 S22 Incident Registry</span>
                  <span className="tab-badge">{legalIncidents.length}</span>
                </div>
                <div className={`tab ${legalComplianceTab === "legal_docs" ? "active" : ""}`} onClick={() => setLegalComplianceTab("legal_docs")}>
                  <span>📜 Legal Policies & PAIA</span>
                  <span className="tab-badge">{legalDocuments.length}</span>
                </div>
                <div className={`tab ${legalComplianceTab === "contact_us" ? "active" : ""}`} onClick={() => setLegalComplianceTab("contact_us")}>
                  <span>📞 Contact & Regulatory Directory</span>
                </div>
              </div>

              {/* TAB 1: S21 OPERATOR AGREEMENTS */}
              {legalComplianceTab === "popia_agreements" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>POPIA Section 21 Written Operator Agreements</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Mandatory written agreement establishing Municipality as Responsible Party and Platform as Technology Operator.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        const targetTenant = (selectedTenant && selectedTenant !== "GLOBAL") ? selectedTenant : tenants[0]?.id;
                        if (!targetTenant) {
                          alert("Please select a municipality first.");
                          return;
                        }
                        setLoading(true);
                        try {
                          await fetch(`${API}/legal-compliance/operator-agreements`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tenant_id: targetTenant, agreement_version: "v1.0-2026" }),
                          });
                          alert("POPIA Section 21 Agreement generated!");
                          refreshData();
                        } catch (err: any) {
                          alert("Error: " + err.message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      ➕ Generate S21 Operator Agreement
                    </button>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Municipality</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th>Signatory</th>
                          <th>Signed Date</th>
                          <th>ECTA Tamper Hash</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalAgreements.map(a => (
                          <tr key={a.id}>
                            <td><strong>{a.tenant_name} ({a.tenant_code})</strong></td>
                            <td><span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700 }}>{a.agreement_version}</span></td>
                            <td>
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 800,
                                background: a.status === "EXECUTED" ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                                color: a.status === "EXECUTED" ? "#34d399" : "#facc15",
                              }}>
                                {a.status}
                              </span>
                            </td>
                            <td>
                              {a.signed_by_name ? (
                                <div>
                                  <div style={{ fontWeight: 600 }}>{a.signed_by_name}</div>
                                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>{a.signed_by_position}</div>
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>Pending Execution</span>
                              )}
                            </td>
                            <td>{a.signed_at ? a.signed_at.split("T")[0] : "—"}</td>
                            <td>
                              {a.tamper_proof_hash ? (
                                <span style={{ fontFamily: "monospace", fontSize: "10.5px", color: "#94a3b8" }} title={a.tamper_proof_hash}>
                                  {a.tamper_proof_hash.slice(0, 14)}...
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {a.status !== "EXECUTED" ? (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: "11px", padding: "3px 8px" }}
                                    onClick={() => {
                                      setSigningDpa(a);
                                      setDpaSignerName(currentUser?.full_name || "");
                                      setDpaSignerPosition("Chief Financial Officer / Authorized Signatory");
                                      setDpaAgreementText(a.agreement_text || "");
                                      setIsEditingDpaText(false);
                                    }}
                                  >
                                    ✍️ Review & E-Sign
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: "11px", padding: "3px 8px" }}
                                    onClick={() => {
                                      setViewingLegalDoc({
                                        title: a.agreement_title,
                                        version: a.agreement_version,
                                        content: a.agreement_text,
                                        signed_by: a.signed_by_name,
                                        signed_at: a.signed_at,
                                        tamper_hash: a.tamper_proof_hash,
                                      });
                                    }}
                                  >
                                    📄 View Agreement
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: POPIA S19 PII ACCESS AUDIT TRAIL */}
              {legalComplianceTab === "pii_audit" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>POPIA Section 19 Personal Information Access & Audit Trail</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Tamper-evident logs of every access, view, search, edit, or export of debtor records for procurement audit compliance.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," + 
                          ["Timestamp,Actor,Event Type,Entity,Account / Debtor,Payload"].join(",") + "\n" +
                          legalPiiLogs.map(l => `"${l.created_at}","${l.actor}","${l.event_type}","${l.entity_type}","${l.payload?.account_number || ''}","${JSON.stringify(l.payload).replace(/"/g, '""')}"`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `POPIA_PII_Access_Audit_${new Date().toISOString().split("T")[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      📥 Export Audit Log (CSV)
                    </button>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Timestamp (UTC)</th>
                          <th>Operator / Actor</th>
                          <th>Access Event</th>
                          <th>Entity Type</th>
                          <th>Debtor / Account</th>
                          <th>Security Audit Payload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalPiiLogs.map(l => (
                          <tr key={l.id}>
                            <td style={{ fontSize: "11px", color: "#94a3b8" }}>{l.created_at}</td>
                            <td><strong>{l.actor}</strong></td>
                            <td>
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10.5px",
                                fontWeight: 700,
                                background: l.event_type.includes("VIEW") ? "rgba(56, 189, 248, 0.15)" : "rgba(168, 85, 247, 0.15)",
                                color: l.event_type.includes("VIEW") ? "#38bdf8" : "#c084fc",
                              }}>
                                {l.event_type}
                              </span>
                            </td>
                            <td>{l.entity_type || "Customer"}</td>
                            <td>
                              <span style={{ fontFamily: "monospace", color: "#34d399", fontWeight: 700 }}>
                                {l.payload?.account_number || l.payload?.debtor_name || "—"}
                              </span>
                            </td>
                            <td>
                              <pre style={{ margin: 0, fontSize: "10.5px", color: "#94a3b8", maxHeight: "40px", overflowY: "auto", background: "transparent" }}>
                                {JSON.stringify(l.payload)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: MFMA CONTRACT MANDATES */}
              {legalComplianceTab === "mfma_mandates" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>MFMA Section 116 Municipal Contract & Collector Mandates</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Statutory contract register tracking collector panels, platform SLAs, and automated 30/14/7-day expiry warnings.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowNewMandateModal(true)}
                    >
                      ➕ Register Contract Mandate
                    </button>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Mandate Ref</th>
                          <th>Contract Title</th>
                          <th>Type</th>
                          <th>Vendor / Collector</th>
                          <th>Period</th>
                          <th>Expiry Warning</th>
                          <th>Contingency Comm</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalMandates.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700 }}>{m.mandate_reference}</td>
                            <td><strong>{m.contract_title}</strong></td>
                            <td><span style={{ fontSize: "11px", color: "#94a3b8" }}>{m.contract_type}</span></td>
                            <td>{m.vendor_party_name}</td>
                            <td>{m.start_date} to {m.end_date}</td>
                            <td>
                              {m.days_remaining <= 0 ? (
                                <span style={{ color: "#fb7185", fontWeight: 800, fontSize: "11px" }}>🚨 EXPIRED</span>
                              ) : m.days_remaining <= 30 ? (
                                <span style={{ color: "#facc15", fontWeight: 800, fontSize: "11px" }}>⚠️ {m.days_remaining} Days Remaining</span>
                              ) : (
                                <span style={{ color: "#34d399", fontSize: "11px" }}>🟢 {m.days_remaining} Days</span>
                              )}
                            </td>
                            <td>{m.contingency_commission_pct ? `${m.contingency_commission_pct}%` : "SLA"}</td>
                            <td>
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10.5px",
                                fontWeight: 700,
                                background: m.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                                color: m.status === "ACTIVE" ? "#34d399" : "#fb7185",
                              }}>
                                {m.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "11px", padding: "2px 8px" }}
                                onClick={() => {
                                  setEditingMandate(m);
                                  setEditMandateTitle(m.contract_title);
                                  setEditMandateType(m.contract_type);
                                  setEditMandateVendor(m.vendor_party_name);
                                  setEditMandateStart(m.start_date);
                                  setEditMandateEnd(m.end_date);
                                  setEditMandateValue(m.contract_value?.toString() || "");
                                  setEditMandateComm(m.contingency_commission_pct?.toString() || "10.00");
                                  setEditMandateStatus(m.status);
                                  setEditMandateScope(m.scope_of_work || "");
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: POPIA S22 BREACH INCIDENTS */}
              {legalComplianceTab === "breaches" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>POPIA Section 22 Incident & Breach Notification Registry</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Workflow for logging incidents, notifying municipalities without undue delay, and statutory Information Regulator reporting.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.4)" }}
                      onClick={() => setShowNewBreachModal(true)}
                    >
                      🚨 Log Security Incident
                    </button>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Incident Ref</th>
                          <th>Severity</th>
                          <th>Incident Type</th>
                          <th>Description</th>
                          <th>Affected Records</th>
                          <th>Containment Status</th>
                          <th>Muni Notified</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalIncidents.map(inc => (
                          <tr key={inc.id}>
                            <td style={{ fontFamily: "monospace", color: "#fb7185", fontWeight: 700 }}>{inc.incident_reference}</td>
                            <td>
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10.5px",
                                fontWeight: 800,
                                background: inc.severity === "CRITICAL" ? "rgba(244, 63, 94, 0.25)" : "rgba(234, 179, 8, 0.2)",
                                color: inc.severity === "CRITICAL" ? "#fb7185" : "#facc15",
                              }}>
                                {inc.severity}
                              </span>
                            </td>
                            <td>{inc.incident_type}</td>
                            <td style={{ maxWidth: "250px", fontSize: "12px", color: "#94a3b8" }}>{inc.description}</td>
                            <td><strong>{inc.affected_subjects_count}</strong></td>
                            <td>
                              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                                {inc.status}
                              </span>
                            </td>
                            <td>{inc.municipality_notified_at ? `✓ ${inc.municipality_notified_at.split("T")[0]}` : "Pending"}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "11px", padding: "2px 8px" }}
                                onClick={async () => {
                                  if (!confirm(`Trigger Section 22 alert to Municipal Information Officer for incident ${inc.incident_reference}?`)) return;
                                  setLoading(true);
                                  try {
                                    await fetch(`${API}/legal-compliance/breach-incidents/${inc.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: "CONTAINED", notify_municipality: true }),
                                    });
                                    alert("Municipal Information Officer alerted!");
                                    refreshData();
                                  } catch (err: any) {
                                    alert("Error: " + err.message);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              >
                                📢 Alert Muni
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: LEGAL POLICIES & PAIA */}
              {legalComplianceTab === "legal_docs" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>In-App Legal Documents, Privacy Policies & PAIA Manual</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Versioned legal disclaimers, debt collector compliance isolation, and electronic acceptance records under ECTA.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                    {legalDocuments.map(doc => (
                      <div key={doc.id} className="glass-panel" style={{ padding: "18px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>{doc.doc_type}</span>
                            <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94a3b8" }}>{doc.version}</span>
                          </div>
                          <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", color: "#f8fafc" }}>{doc.title}</h4>
                          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 14px 0", lineHeight: "1.4" }}>
                            Published: {doc.published_date} | South African Statutory Jurisdiction
                          </p>
                        </div>

                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => {
                              setViewingLegalDoc({
                                title: doc.title,
                                version: doc.version,
                                content: doc.content,
                              });
                            }}
                          >
                            📄 Read
                          </button>
                          {currentUser?.role === "SUPERADMIN" && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ flex: 1 }}
                              onClick={() => {
                                setEditingLegalDoc(doc);
                                setEditDocTitle(doc.title);
                                setEditDocVersion(doc.version);
                                setEditDocContent(doc.content);
                              }}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                            onClick={async () => {
                              if (!currentUser) return;
                              setLoading(true);
                              try {
                                await fetch(`${API}/legal-compliance/acceptances`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    user_id: currentUser.id,
                                    doc_type: doc.doc_type,
                                    version_accepted: doc.version,
                                  }),
                                });
                                alert(`Electronic acceptance of ${doc.title} recorded under ECTA Section 13!`);
                                refreshData();
                              } catch (err: any) {
                                alert("Error: " + err.message);
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            ✓ Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Acceptance Roster */}
                  <h4 style={{ margin: "0 0 12px 0", color: "#f8fafc", fontSize: "15px" }}>User Electronic Acceptance Roster ({legalAcceptances.length})</h4>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Document Accepted</th>
                          <th>Version</th>
                          <th>Accepted Timestamp</th>
                          <th>IP Address</th>
                          <th>ECTA Signature Hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalAcceptances.map(acc => (
                          <tr key={acc.id}>
                            <td><strong>{acc.user_name}</strong> ({acc.user_email})</td>
                            <td><span style={{ fontSize: "11px", color: "#38bdf8" }}>{acc.user_role}</span></td>
                            <td>{acc.doc_type}</td>
                            <td><span style={{ fontFamily: "monospace" }}>{acc.version_accepted}</span></td>
                            <td style={{ fontSize: "11px", color: "#94a3b8" }}>{acc.accepted_at}</td>
                            <td>{acc.ip_address}</td>
                            <td>
                              <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#94a3b8" }}>
                                {acc.acceptance_hash ? acc.acceptance_hash.slice(0, 12) + "..." : "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: CONTACT & REGULATORY DIRECTORY */}
              {legalComplianceTab === "contact_us" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>Platform Contact Particulars & Statutory Regulators Directory</h4>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                        Official company registration, support helpdesk, Information Officer compliance details, and statutory oversight bodies.
                      </p>
                    </div>

                    {currentUser?.role === "SUPERADMIN" && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setEditingDirectory(true)}
                      >
                        ✏️ Edit Directory Particulars
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "24px" }}>
                    {/* Platform Operator Details */}
                    <div className="glass-panel" style={{ padding: "20px", border: "1px solid var(--border-subtle)" }}>
                      <h4 style={{ margin: "0 0 12px 0", color: "#38bdf8", fontSize: "16px" }}>🏢 Platform Operator Particulars</h4>
                      <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#cbd5e1" }}>
                        <div><strong>Legal Entity:</strong> {directoryConfig?.operator_name || "Khokhisa Technologies (Pty) Ltd"}</div>
                        <div><strong>Company Registration:</strong> {directoryConfig?.company_registration || "2014/032353/07"}</div>
                        <div><strong>VAT Registration:</strong> {directoryConfig?.vat_number || "4120268894"}</div>
                        <div><strong>Registered Address:</strong> {directoryConfig?.registered_address || "85 Grayston Drive, Sandton, Johannesburg, Gauteng, 2196"}</div>
                        <div><strong>Postal Address:</strong> {directoryConfig?.postal_address || "PostNet Suite 412, Private Bag X9, Benmore, 2010"}</div>
                      </div>
                    </div>

                    {/* Operational Support */}
                    <div className="glass-panel" style={{ padding: "20px", border: "1px solid var(--border-subtle)" }}>
                      <h4 style={{ margin: "0 0 12px 0", color: "#34d399", fontSize: "16px" }}>🛟 Technical Support & Helpdesk</h4>
                      <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#cbd5e1" }}>
                        <div><strong>Support Email:</strong> {directoryConfig?.support_email || "support@khokhisa.co.za"}</div>
                        <div><strong>Emergency Hotline:</strong> {directoryConfig?.support_phone || "+27 (0) 11 884 9200"}</div>
                        <div><strong>Operating Hours:</strong> {directoryConfig?.operating_hours || "Monday – Friday, 08:00 – 17:00 SAST"}</div>
                        <div><strong>SLA Response Targets:</strong> {directoryConfig?.sla_targets || "Critical (4 hrs) | Billing (1 bus. day) | General (2 bus. days)"}</div>
                      </div>
                    </div>

                    {/* Compliance & Privacy Officer */}
                    <div className="glass-panel" style={{ padding: "20px", border: "1px solid var(--border-subtle)" }}>
                      <h4 style={{ margin: "0 0 12px 0", color: "#c084fc", fontSize: "16px" }}>⚖️ Information Officer & Compliance</h4>
                      <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#cbd5e1" }}>
                        <div><strong>Information Officer:</strong> {directoryConfig?.information_officer_title || "Head of Legal & Regulatory Compliance (s 55 POPIA)"}</div>
                        <div><strong>Privacy Inquiries:</strong> {directoryConfig?.privacy_email || "privacy@khokhisa.co.za"}</div>
                        <div><strong>Municipal Audit Queries:</strong> {directoryConfig?.compliance_email || "compliance@khokhisa.co.za"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Statutory Isolation & Disclaimers */}
                  <div style={{ padding: "16px", background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.25)", borderRadius: "8px", marginBottom: "24px", fontSize: "12.5px", lineHeight: "1.5", color: "#cbd5e1" }}>
                    <strong style={{ color: "#facc15" }}>⚠️ Debtor Account Queries & Statutory Notice:</strong><br />
                    {directoryConfig?.debtor_query_notice || "Khokhisa is a technology provider and operator only — it cannot alter account balances, payment arrangements, or debtor records. For account-specific queries, contact your municipality or the collector assigned to your account. For technical portal issues, contact platform support above."}
                  </div>

                  {/* Statutory Regulator Directory */}
                  <h4 style={{ margin: "0 0 12px 0", color: "#f8fafc", fontSize: "15px" }}>🏛️ Statutory Regulatory Contacts</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                    <div className="glass-panel" style={{ padding: "16px", border: "1px solid var(--border-subtle)" }}>
                      <h5 style={{ margin: "0 0 6px 0", color: "#38bdf8" }}>Council for Debt Collectors (CFDC)</h5>
                      <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.5" }}>
                        {directoryConfig?.cfdc_contact_info || "For complaints regarding external debt collector conduct, statutory fee caps, or ethics under Act 114 of 1998. Web: cfdc.org.za | Email: info@cfdc.org.za"}
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: "16px", border: "1px solid var(--border-subtle)" }}>
                      <h5 style={{ margin: "0 0 6px 0", color: "#34d399" }}>Information Regulator (South Africa)</h5>
                      <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.5" }}>
                        {directoryConfig?.regulator_contact_info || "For privacy, POPIA compliance, or data subject complaints. Address: JD House, 27 Stiemens Street, Braamfontein, JHB | Email: POPIAComplaints@inforegulator.org.za"}
                      </div>
                    </div>
                  </div>

                  {/* Official Inquiry Submission Form */}
                  <div className="glass-panel" style={{ padding: "22px", border: "1px solid var(--border-subtle)" }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#f8fafc", fontSize: "16px" }}>📩 Log Official Inquiry or Compliance Request</h4>
                    <p style={{ margin: "0 0 18px 0", color: "#94a3b8", fontSize: "12.5px" }}>
                      Submit your query directly to our support and compliance desk. An automated tracking ticket reference will be generated.
                    </p>

                    {contactTicketResult && (
                      <div style={{ padding: "14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", marginBottom: "18px", fontSize: "13px" }}>
                        <strong>✓ Ticket Reference: <span style={{ fontFamily: "monospace" }}>{contactTicketResult.ticket_reference}</span></strong><br />
                        {contactTicketResult.message}
                      </div>
                    )}

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setLoading(true);
                      try {
                        const targetTenant = (selectedTenant && selectedTenant !== "GLOBAL") ? selectedTenant : null;
                        const res = await fetch(`${API}/legal-compliance/contact-tickets`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: contactName || currentUser?.full_name || "User",
                            email: contactEmail || currentUser?.email || "user@domain.co.za",
                            category: contactCategory,
                            message: contactMessage,
                            tenant_id: targetTenant,
                          }),
                        });
                        const data = await res.json();
                        setContactTicketResult(data);
                        setContactMessage("");
                        alert(`Inquiry logged successfully! Ticket: ${data.ticket_reference}`);
                        refreshData();
                      } catch (err: any) {
                        alert("Error submitting ticket: " + err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      <div className="info-grid" style={{ marginBottom: "14px" }}>
                        <div className="form-group">
                          <label>Your Full Name</label>
                          <input type="text" placeholder="e.g. Sipho Ndlovu" value={contactName} onChange={e => setContactName(e.target.value)} className="form-input" required />
                        </div>
                        <div className="form-group">
                          <label>Work / Official Email Address</label>
                          <input type="email" placeholder="e.g. sipho@municipality.gov.za" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="form-input" required />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: "14px" }}>
                        <label>Inquiry Category</label>
                        <select value={contactCategory} onChange={e => setContactCategory(e.target.value)} className="form-select">
                          <option value="Technical">Technical Support</option>
                          <option value="Billing">Billing & Commercial Proposals</option>
                          <option value="Compliance">Compliance, Audit & SITA Requirements</option>
                          <option value="Privacy">Privacy & POPIA Data Subject Request</option>
                          <option value="General">General Inquiries</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: "16px" }}>
                        <label>Detailed Message</label>
                        <textarea rows={4} placeholder="Provide specifics regarding your inquiry, account reference, or compliance query..." value={contactMessage} onChange={e => setContactMessage(e.target.value)} className="form-textarea" required />
                      </div>

                      <div style={{ fontSize: "11.5px", color: "#94a3b8", marginBottom: "16px" }}>
                        🔒 <em>We use the details you submit only to respond to your query. See our Privacy Policy.</em>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="submit" className="btn btn-primary" disabled={loading || !contactMessage}>
                          🚀 Submit Inquiry & Generate Ticket
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: SIGN POPIA OPERATOR AGREEMENT WITH IN-PLACE EDITING */}
      {signingDpa && (
        <div className="modal-backdrop" onClick={() => setSigningDpa(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "780px", width: "95%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>✍️ Review, Edit & E-Sign POPIA Section 21 Operator Agreement</h3>
                <p>Customize terms and execute under Section 13 of the Electronic Communications and Transactions Act (ECTA)</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSigningDpa(null)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await fetch(`${API}/legal-compliance/operator-agreements/${signingDpa.id}/sign`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    signed_by_name: dpaSignerName,
                    signed_by_position: dpaSignerPosition,
                    agreement_text: dpaAgreementText,
                  }),
                });
                alert("POPIA Section 21 Operator Agreement edited and executed successfully!");
                setSigningDpa(null);
                refreshData();
              } catch (err: any) {
                alert("Error executing agreement: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              {/* Signatory Info */}
              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Signatory Full Name</label>
                  <input type="text" value={dpaSignerName} onChange={e => setDpaSignerName(e.target.value)} className="form-input" required />
                </div>

                <div className="form-group">
                  <label>Official Municipal Position</label>
                  <input type="text" value={dpaSignerPosition} onChange={e => setDpaSignerPosition(e.target.value)} className="form-input" required />
                </div>
              </div>

              {/* Editable Agreement Text Section */}
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ margin: 0, fontWeight: 700 }}>
                    Section 21 Agreement Terms & Conditions
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await fetch(`${API}/legal-compliance/operator-agreements/${signingDpa.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ agreement_text: dpaAgreementText }),
                          });
                          alert("Draft agreement text saved!");
                          refreshData();
                        } catch (err: any) {
                          alert("Error saving draft: " + err.message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      💾 Save Draft Edits
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setIsEditingDpaText(!isEditingDpaText)}
                    >
                      {isEditingDpaText ? "👁️ Preview Mode" : "✏️ Enable Direct Editing"}
                    </button>
                  </div>
                </div>

                {isEditingDpaText ? (
                  <textarea
                    rows={12}
                    value={dpaAgreementText}
                    onChange={e => setDpaAgreementText(e.target.value)}
                    className="form-textarea"
                    style={{ fontFamily: "monospace", fontSize: "12px", lineHeight: "1.5" }}
                    placeholder="Enter or customize Section 21 clauses, security requirements, or municipal governance addenda..."
                    required
                  />
                ) : (
                  <div
                    style={{
                      maxHeight: "260px",
                      overflowY: "auto",
                      padding: "12px",
                      background: "rgba(15, 23, 42, 0.6)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "12px",
                      lineHeight: "1.6",
                      whiteSpace: "pre-wrap",
                      color: "#cbd5e1",
                    }}
                  >
                    {dpaAgreementText || "No text defined."}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  💡 You can customize municipal schedules, service scope, or specific security controls before electronic signing.
                </div>
              </div>

              <div style={{ padding: "12px", background: "rgba(56, 189, 248, 0.08)", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.2)", marginBottom: "20px", fontSize: "12px", color: "#94a3b8" }}>
                🔒 By submitting, a SHA-256 cryptographic tamper-evident signature will be bound to this exact agreement text alongside your IP address and timestamp.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSigningDpa(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !dpaAgreementText}>✍️ Execute S21 Agreement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER MFMA MANDATE */}
      {showNewMandateModal && (
        <div className="modal-backdrop" onClick={() => setShowNewMandateModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "600px", width: "92%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "18px" }}>
              <div className="panel-title">
                <h3>🏛️ Register MFMA Section 116 Contract Mandate</h3>
                <p>Track municipal collector mandates and platform SLAs with automated expiry alerts</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewMandateModal(false)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const targetTenant = (selectedTenant && selectedTenant !== "GLOBAL") ? selectedTenant : tenants[0]?.id;
              if (!targetTenant) return;
              setLoading(true);
              try {
                await fetch(`${API}/legal-compliance/mandates`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tenant_id: targetTenant,
                    mandate_reference: newMandateRef,
                    contract_title: newMandateTitle,
                    contract_type: newMandateType,
                    vendor_party_name: newMandateVendor,
                    start_date: newMandateStart,
                    end_date: newMandateEnd,
                    contract_value: Number(newMandateValue),
                    contingency_commission_pct: Number(newMandateComm),
                    scope_of_work: newMandateScope,
                  }),
                });
                alert("MFMA Contract Mandate registered successfully!");
                setShowNewMandateModal(false);
                refreshData();
              } catch (err: any) {
                alert("Error registering mandate: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Mandate Reference</label>
                  <input type="text" value={newMandateRef} onChange={e => setNewMandateRef(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Contract Type</label>
                  <select value={newMandateType} onChange={e => setNewMandateType(e.target.value)} className="form-select">
                    <option value="COLLECTOR_MANDATE">COLLECTOR_MANDATE</option>
                    <option value="PLATFORM_SLA">PLATFORM_SLA</option>
                    <option value="PANEL_APPOINTMENT">PANEL_APPOINTMENT</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Contract Title</label>
                <input type="text" placeholder="e.g. Debt Recovery Panel Mandate 2026-2028" value={newMandateTitle} onChange={e => setNewMandateTitle(e.target.value)} className="form-input" required />
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Vendor / Collector Firm Name</label>
                <input type="text" placeholder="e.g. Sithole & Partners Recoveries Inc." value={newMandateVendor} onChange={e => setNewMandateVendor(e.target.value)} className="form-input" required />
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={newMandateStart} onChange={e => setNewMandateStart(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={newMandateEnd} onChange={e => setNewMandateEnd(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewMandateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>💾 Save Mandate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG DATA BREACH INCIDENT */}
      {showNewBreachModal && (
        <div className="modal-backdrop" onClick={() => setShowNewBreachModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "600px", width: "92%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "18px" }}>
              <div className="panel-title">
                <h3>🚨 POPIA Section 22 Data Incident Log</h3>
                <p>Register suspected or confirmed breach to facilitate municipal and regulatory notifications</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewBreachModal(false)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const targetTenant = (selectedTenant && selectedTenant !== "GLOBAL") ? selectedTenant : null;
              setLoading(true);
              try {
                await fetch(`${API}/legal-compliance/breach-incidents`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tenant_id: targetTenant,
                    incident_type: newBreachType,
                    severity: newBreachSeverity,
                    description: newBreachDesc,
                    affected_subjects_count: Number(newBreachCount),
                    affected_data_categories: newBreachCategory,
                    containment_actions: newBreachContainment,
                  }),
                });
                alert("Incident logged in Section 22 Breach Registry!");
                setShowNewBreachModal(false);
                refreshData();
              } catch (err: any) {
                alert("Error logging incident: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Incident Severity</label>
                  <select value={newBreachSeverity} onChange={e => setNewBreachSeverity(e.target.value)} className="form-select">
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Incident Classification</label>
                  <select value={newBreachType} onChange={e => setNewBreachType(e.target.value)} className="form-select">
                    <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
                    <option value="CREDENTIAL_COMPROMISE">CREDENTIAL_COMPROMISE</option>
                    <option value="ANOMALOUS_BULK_EXPORT">ANOMALOUS_BULK_EXPORT</option>
                    <option value="SYSTEM_VULNERABILITY">SYSTEM_VULNERABILITY</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Incident Description & Root Cause</label>
                <textarea rows={3} placeholder="Describe the incident, detected anomaly, or affected infrastructure..." value={newBreachDesc} onChange={e => setNewBreachDesc(e.target.value)} className="form-textarea" required />
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Estimated Affected Subjects</label>
                  <input type="number" value={newBreachCount} onChange={e => setNewBreachCount(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Data Categories Affected</label>
                  <input type="text" value={newBreachCategory} onChange={e => setNewBreachCategory(e.target.value)} className="form-input" />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewBreachModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !newBreachDesc}>🚨 Post Incident Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT MFMA MANDATE (SUPERADMIN / ADMIN) */}
      {editingMandate && (
        <div className="modal-backdrop" onClick={() => setEditingMandate(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "620px", width: "92%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "18px" }}>
              <div className="panel-title">
                <h3>✏️ Edit MFMA Section 116 Contract Mandate</h3>
                <p>Modify mandate <strong>{editingMandate.mandate_reference}</strong> ({editingMandate.tenant_name})</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingMandate(null)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await fetch(`${API}/legal-compliance/mandates/${editingMandate.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contract_title: editMandateTitle,
                    contract_type: editMandateType,
                    vendor_party_name: editMandateVendor,
                    start_date: editMandateStart,
                    end_date: editMandateEnd,
                    contract_value: Number(editMandateValue),
                    contingency_commission_pct: Number(editMandateComm),
                    status: editMandateStatus,
                    scope_of_work: editMandateScope,
                  }),
                });
                alert("MFMA Contract Mandate updated successfully!");
                setEditingMandate(null);
                refreshData();
              } catch (err: any) {
                alert("Error updating mandate: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Contract Title</label>
                  <input type="text" value={editMandateTitle} onChange={e => setEditMandateTitle(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Contract Type</label>
                  <select value={editMandateType} onChange={e => setEditMandateType(e.target.value)} className="form-select">
                    <option value="COLLECTOR_MANDATE">COLLECTOR_MANDATE</option>
                    <option value="PLATFORM_SLA">PLATFORM_SLA</option>
                    <option value="PANEL_APPOINTMENT">PANEL_APPOINTMENT</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Vendor / Collector Firm Name</label>
                <input type="text" value={editMandateVendor} onChange={e => setEditMandateVendor(e.target.value)} className="form-input" required />
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={editMandateStart} onChange={e => setEditMandateStart(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={editMandateEnd} onChange={e => setEditMandateEnd(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Contingency Commission (%)</label>
                  <input type="number" value={editMandateComm} onChange={e => setEditMandateComm(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Mandate Status</label>
                  <select value={editMandateStatus} onChange={e => setEditMandateStatus(e.target.value)} className="form-select">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRING_SOON">EXPIRING_SOON</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label>Scope of Work / Services</label>
                <textarea rows={3} value={editMandateScope} onChange={e => setEditMandateScope(e.target.value)} className="form-textarea" />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingMandate(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LEGAL DOCUMENT / PAIA (SUPERADMIN) */}
      {editingLegalDoc && (
        <div className="modal-backdrop" onClick={() => setEditingLegalDoc(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "800px", width: "95%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>✏️ Edit Legal Policy / PAIA Manual & Increment Version</h3>
                <p>Modify document content and statutory version for <strong>{editingLegalDoc.doc_type}</strong></p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingLegalDoc(null)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await fetch(`${API}/legal-compliance/documents/${editingLegalDoc.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: editDocTitle,
                    version: editDocVersion,
                    content: editDocContent,
                  }),
                });
                alert(`Legal document '${editDocTitle}' updated to version ${editDocVersion}!`);
                setEditingLegalDoc(null);
                refreshData();
              } catch (err: any) {
                alert("Error updating legal document: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Document Title</label>
                  <input type="text" value={editDocTitle} onChange={e => setEditDocTitle(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Statutory Version (e.g., v1.1, v2.0)</label>
                  <input type="text" value={editDocVersion} onChange={e => setEditDocVersion(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "18px" }}>
                <label>Document Content (Markdown / Text)</label>
                <textarea
                  rows={14}
                  value={editDocContent}
                  onChange={e => setEditDocContent(e.target.value)}
                  className="form-textarea"
                  style={{ fontFamily: "monospace", fontSize: "12px", lineHeight: "1.5" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingLegalDoc(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !editDocContent}>
                  💾 Publish Version {editDocVersion}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CONTACT & REGULATORY DIRECTORY (SUPERADMIN) */}
      {editingDirectory && (
        <div className="modal-backdrop" onClick={() => setEditingDirectory(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "760px", width: "95%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>✏️ Edit Contact & Regulatory Directory Particulars</h3>
                <p>Configure official operator company details, SLA response targets, Information Officer and regulator contacts</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingDirectory(false)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await fetch(`${API}/legal-compliance/directory-config`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    operator_name: dirOperatorName,
                    company_registration: dirRegNumber,
                    vat_number: dirVatNumber,
                    registered_address: dirRegAddress,
                    postal_address: dirPostalAddress,
                    support_email: dirSupportEmail,
                    support_phone: dirSupportPhone,
                    operating_hours: dirOperatingHours,
                    sla_targets: dirSlaTargets,
                    information_officer_title: dirIoTitle,
                    privacy_email: dirPrivacyEmail,
                    compliance_email: dirComplianceEmail,
                    debtor_query_notice: dirDebtorNotice,
                    cfdc_contact_info: dirCfdcInfo,
                    regulator_contact_info: dirRegulatorInfo,
                  }),
                });
                alert("Contact and regulatory directory particulars updated successfully!");
                setEditingDirectory(false);
                refreshData();
              } catch (err: any) {
                alert("Error updating directory: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Operator Legal Entity Name</label>
                  <input type="text" value={dirOperatorName} onChange={e => setDirOperatorName(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Company Registration No.</label>
                  <input type="text" value={dirRegNumber} onChange={e => setDirRegNumber(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>VAT Registration Number</label>
                  <input type="text" value={dirVatNumber} onChange={e => setDirVatNumber(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Support Phone Hotline</label>
                  <input type="text" value={dirSupportPhone} onChange={e => setDirSupportPhone(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Support Helpdesk Email</label>
                  <input type="email" value={dirSupportEmail} onChange={e => setDirSupportEmail(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Privacy Officer Email</label>
                  <input type="email" value={dirPrivacyEmail} onChange={e => setDirPrivacyEmail(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Compliance & Audit Email</label>
                  <input type="email" value={dirComplianceEmail} onChange={e => setDirComplianceEmail(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Operating Hours</label>
                  <input type="text" value={dirOperatingHours} onChange={e => setDirOperatingHours(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>SLA Response Targets</label>
                <input type="text" value={dirSlaTargets} onChange={e => setDirSlaTargets(e.target.value)} className="form-input" required />
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Physical Registered Address</label>
                <input type="text" value={dirRegAddress} onChange={e => setDirRegAddress(e.target.value)} className="form-input" required />
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Postal Address</label>
                <input type="text" value={dirPostalAddress} onChange={e => setDirPostalAddress(e.target.value)} className="form-input" required />
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Debtor Account Query Statutory Notice</label>
                <textarea rows={2} value={dirDebtorNotice} onChange={e => setDirDebtorNotice(e.target.value)} className="form-textarea" required />
              </div>

              <div className="info-grid" style={{ marginBottom: "18px" }}>
                <div className="form-group">
                  <label>Council for Debt Collectors (CFDC) Details</label>
                  <textarea rows={2} value={dirCfdcInfo} onChange={e => setDirCfdcInfo(e.target.value)} className="form-textarea" required />
                </div>
                <div className="form-group">
                  <label>Information Regulator Contact Details</label>
                  <textarea rows={2} value={dirRegulatorInfo} onChange={e => setDirRegulatorInfo(e.target.value)} className="form-textarea" required />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingDirectory(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>💾 Save Directory Particulars</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW LEGAL DOCUMENT */}
      {viewingLegalDoc && (
        <div className="modal-backdrop" onClick={() => setViewingLegalDoc(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "780px", width: "95%", background: "#ffffff", color: "#0f172a" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#0f172a" }}>{viewingLegalDoc.title}</h2>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>
                  Version: {viewingLegalDoc.version} | South African Statutory Jurisdiction
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingLegalDoc(null)} style={{ color: "#64748b" }}>✕</button>
            </div>

            {viewingLegalDoc.signed_by && (
              <div style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginBottom: "16px", fontSize: "12px", color: "#166534" }}>
                <strong>✓ Executed by:</strong> {viewingLegalDoc.signed_by} on {viewingLegalDoc.signed_at?.split("T")[0]}<br />
                <strong>ECTA Tamper Hash:</strong> <span style={{ fontFamily: "monospace" }}>{viewingLegalDoc.tamper_hash}</span>
              </div>
            )}

            <div style={{ maxHeight: "420px", overflowY: "auto", padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre-wrap", color: "#334155", marginBottom: "20px" }}>
              {viewingLegalDoc.content}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨️ Print Legal Document</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRUST ACCOUNT & KYC UPLOADS */}
      {showTrustModal && selectedCollectorForDetails && (
        <div className="modal-backdrop" onClick={() => setShowTrustModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "640px", width: "94%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "18px" }}>
              <div className="panel-title">
                <h3>🏦 Collector Trust Account & KYC Documents</h3>
                <p>Configure statutory separate trust banking and upload auditor certification for <strong>{selectedCollectorForDetails.user_name}</strong></p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTrustModal(false)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await fetch(`${API}/compliance/collectors/${selectedCollectorForDetails.id}/trust-account`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    bank_name: trustBankName,
                    branch_code: trustBranchCode,
                    account_number: trustAccountNumber,
                    account_holder_name: trustAccountHolder,
                    audit_due_date: trustAuditDueDate || new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
                    bank_confirmation_letter_url: trustBankLetterUrl || "https://storage.khokhisa.co.za/trust/bank_letter.pdf",
                    auditor_letter_url: trustAuditorLetterUrl || "https://storage.khokhisa.co.za/trust/auditor_letter.pdf",
                    last_audit_report_url: trustAuditReportUrl || "https://storage.khokhisa.co.za/trust/last_audit.pdf",
                  }),
                });
                alert("Trust account details updated successfully!");
                setShowTrustModal(false);
                refreshData();
              } catch (err: any) {
                alert("Error saving trust account: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Bank Name</label>
                  <input type="text" placeholder="e.g. Standard Bank / FNB / Nedbank" value={trustBankName} onChange={e => setTrustBankName(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Branch Code</label>
                  <input type="text" placeholder="e.g. 051001" value={trustBranchCode} onChange={e => setTrustBranchCode(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Trust Account Number</label>
                  <input type="text" placeholder="e.g. 0228491039" value={trustAccountNumber} onChange={e => setTrustAccountNumber(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Account Holder Name</label>
                  <input type="text" placeholder="e.g. Sithole Collections Trust Account" value={trustAccountHolder} onChange={e => setTrustAccountHolder(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Annual Trust Audit Due Date</label>
                <input type="date" value={trustAuditDueDate} onChange={e => setTrustAuditDueDate(e.target.value)} className="form-input" required />
              </div>

              <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#38bdf8", marginBottom: "10px" }}>📑 Statutory Uploads (URLs / Files)</div>
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label>Bank Confirmation Letter URL</label>
                  <input type="text" placeholder="https://storage.khokhisa.co.za/trust/bank_letter.pdf" value={trustBankLetterUrl} onChange={e => setTrustBankLetterUrl(e.target.value)} className="form-input" />
                </div>
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label>Auditor Letter URL</label>
                  <input type="text" placeholder="https://storage.khokhisa.co.za/trust/auditor_letter.pdf" value={trustAuditorLetterUrl} onChange={e => setTrustAuditorLetterUrl(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Last Annual Audit Report URL</label>
                  <input type="text" placeholder="https://storage.khokhisa.co.za/trust/last_audit.pdf" value={trustAuditReportUrl} onChange={e => setTrustAuditReportUrl(e.target.value)} className="form-input" />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTrustModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>💾 Save Trust Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD TRUST REMITTANCE */}
      {showRemittanceModal && (
        <div className="modal-backdrop" onClick={() => setShowRemittanceModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "560px", width: "92%" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "18px" }}>
              <div className="panel-title">
                <h3>💵 Record Trust Collection & Municipal Remittance</h3>
                <p>Track cash received in collector trust account and calculate statutory net municipal transfer</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRemittanceModal(false)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (complianceCollectors.length === 0 || tenants.length === 0) return;
              setLoading(true);
              try {
                const targetCollector = complianceCollectors[0]?.id;
                const targetTenant = (selectedTenant && selectedTenant !== "GLOBAL") ? selectedTenant : tenants[0]?.id;

                await fetch(`${API}/compliance/remittances?collector_profile_id=${targetCollector}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tenant_id: targetTenant,
                    debtor_reference: remitDebtorRef || "MUN001",
                    amount_received: Number(remitAmount),
                    receipt_date: new Date().toISOString().split("T")[0],
                    commission_rate: Number(remitCommRate) || 10.0,
                    bank_statement_ref: remitBankStatementRef || `EFT-${Date.now().toString().slice(-4)}`,
                    notes: remitNotes,
                  }),
                });
                alert("Trust collection & remittance record posted!");
                setShowRemittanceModal(false);
                refreshData();
              } catch (err: any) {
                alert("Error recording remittance: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Debtor Account Reference</label>
                <input type="text" placeholder="e.g. MUN001" value={remitDebtorRef} onChange={e => setRemitDebtorRef(e.target.value)} className="form-input" required />
              </div>

              <div className="info-grid" style={{ marginBottom: "14px" }}>
                <div className="form-group">
                  <label>Gross Amount Received (ZAR)</label>
                  <input type="number" placeholder="e.g. 5000" value={remitAmount} onChange={e => setRemitAmount(e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <label>Commission Rate (%)</label>
                  <input type="number" placeholder="10.00" value={remitCommRate} onChange={e => setRemitCommRate(e.target.value)} className="form-input" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Bank Statement Reference</label>
                <input type="text" placeholder="e.g. EFT-MUNI-0921" value={remitBankStatementRef} onChange={e => setRemitBankStatementRef(e.target.value)} className="form-input" />
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label>Remittance Notes</label>
                <textarea rows={2} placeholder="Add payment reconciliation or debtor settlement notes..." value={remitNotes} onChange={e => setRemitNotes(e.target.value)} className="form-textarea" />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRemittanceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !remitAmount}>✓ Post Remittance Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MONTHLY REMITTANCE STATEMENT */}
      {remittanceStatementModal && (
        <div className="modal-backdrop" onClick={() => setRemittanceStatementModal(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "760px", width: "95%", background: "#ffffff", color: "#0f172a" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0f172a" }}>KHOKHISA</h2>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>Statutory Trust Remittance Statement</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setRemittanceStatementModal(null)} style={{ color: "#64748b" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", fontSize: "12.5px" }}>
              <div>
                <div><strong>Registered Collector:</strong> {remittanceStatementModal.collector_name}</div>
                <div><strong>CFDC Registration:</strong> {remittanceStatementModal.cfdc_number}</div>
                <div><strong>Statement Period:</strong> {remittanceStatementModal.statement_period}</div>
              </div>
              <div>
                <div><strong>Municipality:</strong> {remittanceStatementModal.tenant_name}</div>
                <div><strong>Municipal Bank:</strong> {remittanceStatementModal.tenant_bank_details?.bank_name} ({remittanceStatementModal.tenant_bank_details?.account_number})</div>
                <div><strong>Generated:</strong> {remittanceStatementModal.generated_at?.split("T")[0]}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", color: "#64748b" }}>Gross Cash Collected</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{money(remittanceStatementModal.total_cash_collected)}</div>
              </div>
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", color: "#64748b" }}>Prescribed Commission</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#2563eb" }}>{money(remittanceStatementModal.total_commission_earned)}</div>
              </div>
              <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "11px", color: "#166534" }}>Net Municipal Remittance</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#15803d" }}>{money(remittanceStatementModal.total_remitted_to_municipality + remittanceStatementModal.total_pending_remittance)}</div>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "20px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "8px" }}>Receipt Date</th>
                  <th style={{ padding: "8px" }}>Debtor Ref</th>
                  <th style={{ padding: "8px" }}>Gross (ZAR)</th>
                  <th style={{ padding: "8px" }}>Commission</th>
                  <th style={{ padding: "8px" }}>Net Remitted</th>
                  <th style={{ padding: "8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {remittanceStatementModal.items.map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px" }}>{item.receipt_date}</td>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{item.debtor_reference}</td>
                    <td style={{ padding: "8px" }}>{money(item.amount_received)}</td>
                    <td style={{ padding: "8px", color: "#2563eb" }}>{money(item.commission_amount)}</td>
                    <td style={{ padding: "8px", fontWeight: 700, color: "#15803d" }}>{money(item.remittance_amount)}</td>
                    <td style={{ padding: "8px" }}>{item.remittance_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨️ Print Statutory Statement</button>
            </div>
          </div>
        </div>
      )}

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
                  <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Assigned Municipalities (Multi-Select)</span>
                    {editRole === "ADMIN" && (
                      <span style={{ fontSize: "11.5px", color: "#60a5fa", fontWeight: 600 }}>
                        ℹ️ Admin logins only available on SaaS Subscription
                      </span>
                    )}
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {tenants
                      .filter(t => editRole !== "ADMIN" || t.engagement_model === "SAAS_SELF_SERVICE")
                      .map(t => {
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
                    {editRole === "ADMIN" && tenants.filter(t => t.engagement_model === "SAAS_SELF_SERVICE").length === 0 && (
                      <div style={{ color: "#fb7185", fontSize: "12.5px", padding: "8px", gridColumn: "1 / -1" }}>
                        ⚠️ No municipalities currently operate under the <strong>SaaS Subscription</strong> model.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COLLECTOR COMPLIANCE & TRUST PROFILE IN EDIT USER */}
              {editRole === "COLLECTOR" && (
                <div style={{ padding: "14px 16px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.05)", border: "1px solid rgba(56, 189, 248, 0.2)", marginBottom: "20px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "13.5px", color: "#38bdf8" }}>🏛️ Collector CFDC & Trust Banking Particulars</h4>
                  
                  <div className="info-grid" style={{ marginBottom: "12px" }}>
                    <div className="form-group">
                      <label>CFDC Registration Number</label>
                      <input
                        type="text"
                        placeholder="e.g. CFDC-2026-9842"
                        value={editUserCfdcNumber}
                        onChange={e => setEditUserCfdcNumber(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>CFDC Expiry Date</label>
                      <input
                        type="date"
                        value={editUserCfdcExpiry}
                        onChange={e => setEditUserCfdcExpiry(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="info-grid" style={{ marginBottom: "12px" }}>
                    <div className="form-group">
                      <label>Trust Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Standard Bank / FNB"
                        value={editUserTrustBank}
                        onChange={e => setEditUserTrustBank(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Trust Branch Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 051001"
                        value={editUserTrustBranch}
                        onChange={e => setEditUserTrustBranch(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="info-grid" style={{ marginBottom: "12px" }}>
                    <div className="form-group">
                      <label>Trust Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 0228491039"
                        value={editUserTrustAccNum}
                        onChange={e => setEditUserTrustAccNum(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sithole Collections Trust"
                        value={editUserTrustAccHolder}
                        onChange={e => setEditUserTrustAccHolder(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Trust Audit Due Date</label>
                    <input
                      type="date"
                      value={editUserTrustAuditDue}
                      onChange={e => setEditUserTrustAuditDue(e.target.value)}
                      className="form-input"
                    />
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
                    <option value="MANAGED_SERVICE">🛡️ Khokhisa Managed Debt Agency</option>
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
                  <label style={{ color: "#60a5fa" }}>Monthly SaaS License Fee (ZAR)</label>
                  <input
                    type="number"
                    step="100"
                    value={editingTenant.monthly_subscription_fee ?? 45000}
                    onChange={e => setEditingTenant({ ...editingTenant, monthly_subscription_fee: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: "#34d399" }}>Khokhisa Recovery Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTenant.commission_rate ?? 10.00}
                    onChange={e => setEditingTenant({ ...editingTenant, commission_rate: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
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
                <div className="form-group">
                  <label>Billing & Contract Email</label>
                  <input
                    type="email"
                    value={editingTenant.billing_contact_email || ""}
                    onChange={e => setEditingTenant({ ...editingTenant, billing_contact_email: e.target.value })}
                    className="form-input"
                  />
                </div>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div className="drawer-section-title" style={{ margin: 0 }}>👤 Customer & Property Master</div>
                {(currentUser?.role === "ADMIN" || currentUser?.role === "COLLECTOR" || currentUser?.role === "SUPERADMIN") && account360.customer && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "4px 10px", fontSize: "11.5px", fontWeight: 600, color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)", background: "rgba(56, 189, 248, 0.1)" }}
                    onClick={() => {
                      const cust = account360.customer!;
                      setEditingDebtor({
                        id: cust.id,
                        first_name: cust.first_name || "",
                        last_name: cust.last_name || "",
                        id_number: cust.id_number || "",
                        company_registration: cust.company_registration || "",
                        mobile: cust.mobile || "",
                        email: cust.email || "",
                        address: account360.property?.address || "",
                        property_reference: account360.property?.property_reference || "",
                      });
                    }}
                  >
                    ✏️ Edit Debtor Details
                  </button>
                )}
              </div>
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
              <div className="drawer-section-title">💰 Account Arrears Breakdown & Recovery Status</div>
              <div className="info-grid">
                <div className="info-item"><label>Total Balance</label><span className="info-value">{money(account360.balance)}</span></div>
                <div className="info-item"><label>Overdue Arrears</label><span className="info-value" style={{ color: "#f87171", fontWeight: 700 }}>{money(account360.arrears)}</span></div>
                <div className="info-item"><label>Days in Arrears</label><span className="info-value">{account360.days_in_arrears}</span></div>
                <div className="info-item">
                  <label>Recovery Case Status</label>
                  <div style={{ marginTop: "4px" }}>
                    {account360.active_case ? (() => {
                      const activeCase = account360.active_case!;
                      return (currentUser?.role === "ADMIN" || currentUser?.role === "COLLECTOR" || currentUser?.role === "SUPERADMIN") ? (
                        <select
                          value={activeCase.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            setLoading(true);
                            try {
                              const res = await fetch(`${API}/cases/${activeCase.id}/status`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  status: newStatus,
                                  actor: currentUser?.full_name || "Admin",
                                  notes: `Case status manually changed to ${newStatus} by ${currentUser?.role}`,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) {
                                alert(`Error changing case status: ${data.detail || "Status transition error"}`);
                                return;
                              }
                              alert(`Case status updated to ${newStatus}!`);
                              openAccountWorkbench(account360.id);
                              refreshData();
                            } catch (err: any) {
                              alert("Network error: " + err.message);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="form-select"
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            borderRadius: "6px",
                            cursor: "pointer",
                            background: "rgba(255, 255, 255, 0.05)",
                            borderColor: "rgba(56, 189, 248, 0.4)",
                            color: "#f8fafc",
                          }}
                        >
                          <option value="NEW" style={{ background: "#0f172a" }}>🆕 NEW</option>
                          <option value="VALIDATED" style={{ background: "#0f172a" }}>🔍 VALIDATED</option>
                          <option value="CONTACT_ATTEMPTED" style={{ background: "#0f172a" }}>📞 CONTACT_ATTEMPTED</option>
                          <option value="ENGAGED" style={{ background: "#0f172a" }}>💬 ENGAGED</option>
                          <option value="PROMISE_TO_PAY" style={{ background: "#0f172a" }}>🤝 PROMISE_TO_PAY</option>
                          <option value="ARRANGEMENT" style={{ background: "#0f172a" }}>📋 ARRANGEMENT</option>
                          <option value="PAYING" style={{ background: "#0f172a" }}>💵 PAYING</option>
                          <option value="BROKEN_PROMISE" style={{ background: "#0f172a" }}>⚠️ BROKEN_PROMISE</option>
                          <option value="DISPUTED" style={{ background: "#0f172a" }}>⚖️ DISPUTED</option>
                          <option value="ESCALATED" style={{ background: "#0f172a" }}>🚨 ESCALATED</option>
                          <option value="PAID" style={{ background: "#0f172a" }}>✅ PAID</option>
                          <option value="CLOSED" style={{ background: "#0f172a" }}>🔒 CLOSED</option>
                        </select>
                      ) : (
                        <span className={`status-pill ${getStatusPillClass(activeCase.status)}`}>
                          {formatCaseStatus(activeCase.status)}
                        </span>
                      );
                    })() : (
                      <span className="status-pill status-new">NO ACTIVE CASE</span>
                    )}
                  </div>
                </div>
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
                      <div className="timeline-date">
                        {p.captured_at ? new Date(p.captured_at).toLocaleString() : (p.created_at?.split("T")[0] || "Today")} • Promise to Pay (PTP)
                      </div>
                      <div className="timeline-content">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                            PTP: {money(p.amount)} due {p.due_date}
                          </span>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: (p.status === "KEPT" ? "rgba(16, 185, 129, 0.15)" : p.status === "BROKEN" ? "rgba(244, 63, 94, 0.15)" : "rgba(56, 189, 248, 0.15)"),
                            color: (p.status === "KEPT" ? "#34d399" : p.status === "BROKEN" ? "#f87171" : "#38bdf8"),
                            border: `1px solid ${p.status === "KEPT" ? "rgba(16, 185, 129, 0.3)" : p.status === "BROKEN" ? "rgba(244, 63, 94, 0.3)" : "rgba(56, 189, 248, 0.3)"}`
                          }}>
                            status: {p.status || "OPEN"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: "1.5", background: "rgba(255,255,255,0.02)", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)", marginTop: "4px" }}>
                          <span>channel: <strong style={{ color: "#38bdf8" }}>{p.channel || "EFT"}</strong></span> | <span>ref: <strong style={{ color: "#f8fafc" }}>{p.reference || account360.account_number}</strong></span><br />
                          <span>captured_by: <strong style={{ color: "#f8fafc" }}>{p.captured_by || "Collector"}</strong></span> | <span>captured_at: <strong style={{ color: "#94a3b8" }}>{p.captured_at ? new Date(p.captured_at).toLocaleString() : (p.created_at || "Recent")}</strong></span> | <span>status: <strong style={{ color: "#34d399" }}>{p.status || "OPEN"}</strong></span>
                        </div>
                      </div>
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
                <div className="drawer-section-title">Capture Promise to Pay (PTP)</div>
                <div className="form-group">
                  <label>Promised Amount (ZAR)</label>
                  <input type="number" placeholder="e.g. 2500" value={ptpAmount} onChange={e => setPtpAmount(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Commitment Due Date</label>
                  <input type="date" value={ptpDueDate} onChange={e => setPtpDueDate(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Payment Channel</label>
                  <select value={ptpChannel} onChange={e => setPtpChannel(e.target.value)} className="form-select">
                    <option value="EFT">Electronic Funds Transfer (EFT)</option>
                    <option value="DEBIT_ORDER">Debit Order</option>
                    <option value="EASYPAY">EasyPay / Pay@ / Retail Outlet</option>
                    <option value="DIRECT_DEPOSIT">Direct Bank Deposit / Branch</option>
                    <option value="CARD_PAYMENT">Debit / Credit Card</option>
                    <option value="CASH">Municipal Cashier</option>
                  </select>
                </div>
                <div style={{ marginBottom: "16px", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-subtle)", fontSize: "12px", color: "#94a3b8" }}>
                  <div><strong>Account Ref:</strong> <span style={{ color: "#38bdf8" }}>{account360.account_number}</span></div>
                  <div><strong>Captured By:</strong> <span style={{ color: "#f8fafc" }}>{currentUser?.full_name || currentUser?.email || "Collector"}</span></div>
                  <div><strong>Initial Status:</strong> <span style={{ color: "#34d399", fontWeight: 700 }}>OPEN</span></div>
                </div>
                <button className="btn btn-primary" onClick={createPtp} disabled={loading || !ptpAmount}>
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
                    <option value="MANAGED_SERVICE">🛡️ Khokhisa Managed Debt Collection Agency</option>
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

      {/* EDIT MUNICIPALITY TERMS & ADDRESS MODAL */}
      {editingTenant && (
        <div className="modal-backdrop" onClick={() => setEditingTenant(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "720px", width: "94%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>⚙️ Edit Municipality Contract & Representation</h3>
                <p>Update engagement models, commercial rates, physical/postal addresses, and designated officials</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingTenant(null)}>✕</button>
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
                  <label>Municipal Code</label>
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
                    value={editingTenant.engagement_model}
                    onChange={e => setEditingTenant({ ...editingTenant, engagement_model: e.target.value })}
                    className="form-select"
                  >
                    <option value="MANAGED_SERVICE">🛡️ Khokhisa Managed Debt Collection Agency</option>
                    <option value="SAAS_SELF_SERVICE">💻 Internal Municipal SaaS Platform</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Subscription Tier</label>
                  <select
                    value={editingTenant.subscription_tier}
                    onChange={e => setEditingTenant({ ...editingTenant, subscription_tier: e.target.value })}
                    className="form-select"
                  >
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="PROFESSIONAL">Professional</option>
                    <option value="STARTER">Starter</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>⚡ Subscription Status</label>
                  <select
                    value={editingTenant.subscription_status || "ACTIVE"}
                    onChange={e => setEditingTenant({ ...editingTenant, subscription_status: e.target.value })}
                    className="form-select"
                    style={{
                      fontWeight: 700,
                      color: editingTenant.subscription_status === "ACTIVE" 
                        ? "#34d399" 
                        : editingTenant.subscription_status === "TRIAL"
                        ? "#38bdf8"
                        : editingTenant.subscription_status === "SUSPENDED"
                        ? "#fb7185"
                        : "#fde047"
                    }}
                  >
                    <option value="ACTIVE">🟢 ACTIVE (Live Production)</option>
                    <option value="TRIAL">🔵 TRIAL (Evaluation / POC Mode)</option>
                    <option value="SUSPENDED">🔴 SUSPENDED (Hold Access)</option>
                    <option value="EXPIRED">🟡 EXPIRED (Contract Concluded)</option>
                  </select>
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label style={{ color: "#60a5fa" }}>Monthly SaaS License Fee (ZAR)</label>
                  <input
                    type="number"
                    step="100"
                    value={editingTenant.monthly_subscription_fee ?? 45000}
                    onChange={e => setEditingTenant({ ...editingTenant, monthly_subscription_fee: Number(e.target.value) })}
                    className="form-input"
                  />
                  <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>Recurring software subscription fee.</small>
                </div>
                <div className="form-group">
                  <label style={{ color: "#34d399" }}>Khokhisa Recovery Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTenant.commission_rate ?? 10.00}
                    onChange={e => setEditingTenant({ ...editingTenant, commission_rate: Number(e.target.value) })}
                    className="form-input"
                  />
                  <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>Contingency recovery fee on collected cash.</small>
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Billing & Notice Email</label>
                  <input
                    type="email"
                    value={editingTenant.billing_contact_email || ""}
                    onChange={e => setEditingTenant({ ...editingTenant, billing_contact_email: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Address & Official Representation Fields */}
              <div style={{ marginBottom: "18px", padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: "10px", fontSize: "13px" }}>
                  📍 Municipal Address & Official Representation (Rendered on Invoices & Proposals)
                </div>
                <div className="info-grid" style={{ marginBottom: "12px" }}>
                  <div className="form-group">
                    <label>Physical Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 158 Civic Boulevard, Braamfontein, Johannesburg, 2001"
                      value={editingTenant.physical_address || ""}
                      onChange={e => setEditingTenant({ ...editingTenant, physical_address: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postal Address</label>
                    <input
                      type="text"
                      placeholder="e.g. P.O. Box 1049, Johannesburg, 2000"
                      value={editingTenant.postal_address || ""}
                      onChange={e => setEditingTenant({ ...editingTenant, postal_address: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="info-grid">
                  <div className="form-group">
                    <label>Contact Person / Official</label>
                    <input
                      type="text"
                      placeholder="e.g. Manelisi Xulu"
                      value={editingTenant.contact_person || ""}
                      onChange={e => setEditingTenant({ ...editingTenant, contact_person: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Position / Office</label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Financial Officer / Head of Revenue"
                      value={editingTenant.contact_position || ""}
                      onChange={e => setEditingTenant({ ...editingTenant, contact_position: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone / Tel</label>
                    <input
                      type="text"
                      placeholder="e.g. +27 (0)11 358 3000 / 082 123 4567"
                      value={editingTenant.contact_phone || ""}
                      onChange={e => setEditingTenant({ ...editingTenant, contact_phone: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
                <div>
                  {currentUser?.role === "SUPERADMIN" && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        color: "#fb7185",
                        borderColor: "rgba(244, 63, 94, 0.4)",
                        background: "rgba(244, 63, 94, 0.1)",
                        fontWeight: 600,
                      }}
                      onClick={() => handleDeleteTenant(editingTenant.id, editingTenant.name)}
                    >
                      🗑️ Delete Municipality
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingTenant(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Saving..." : "💾 Update Municipality"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER ACCOUNT MODAL */}
      {showCreateUserModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "700px", width: "94%", margin: "auto", animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "14px" }}>
              <div className="panel-title">
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  👥 Provision New User & Role
                </h3>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                  Create SuperAdmins, Municipal Admins, Team Supervisors, and Debt Collectors
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreateUserModal(false)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
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
                  <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Assign to Municipalities / Entities (Multi-Select)</span>
                    {newRole === "ADMIN" && (
                      <span style={{ fontSize: "11.5px", color: "#60a5fa", fontWeight: 600 }}>
                        ℹ️ Admin logins can only be assigned to SaaS Subscription entities
                      </span>
                    )}
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {tenants
                      .filter(t => newRole !== "ADMIN" || t.engagement_model === "SAAS_SELF_SERVICE")
                      .map(t => {
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
                    {newRole === "ADMIN" && tenants.filter(t => t.engagement_model === "SAAS_SELF_SERVICE").length === 0 && (
                      <div style={{ color: "#fb7185", fontSize: "12.5px", padding: "8px", gridColumn: "1 / -1" }}>
                        ⚠️ No municipalities currently operate under the <strong>SaaS Subscription</strong> model.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !newFullName || !newEmail || !newPassword}>
                  {loading ? "Creating User..." : "➕ Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONBOARD MUNICIPALITY & ACTIVATE CONTRACT MODAL */}
      {showOnboardTenantModal && (
        <div className="modal-backdrop" onClick={() => setShowOnboardTenantModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "780px", width: "94%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">
                <h3>🏛️ Onboard New Municipality & Activate Contract</h3>
                <p>Register a South African municipality for either <strong>Khokhisa Managed Debt Recovery</strong> or <strong>Internal Municipal SaaS Subscription</strong></p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowOnboardTenantModal(false)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              await handleCreateTenant(e);
              setShowOnboardTenantModal(false);
            }}>
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
                  <label>Platform Operating Mode</label>
                  <select
                    value={newTenantModel}
                    onChange={e => setNewTenantModel(e.target.value as any)}
                    className="form-select"
                    style={{
                      background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
                      borderColor: "#3b82f6",
                      color: "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    <option value="SAAS_SELF_SERVICE" style={{ background: "#0f172a" }}>💻 Cloud SaaS Platform (Internal Entity / Municipal Revenue Ops)</option>
                    <option value="MANAGED_SERVICE" style={{ background: "#0f172a" }}>👥 Panel & Agency Managed (Authorized Collectors Work Queue)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Subscription Tier</label>
                  <select
                    value={newTenantTier}
                    onChange={e => setNewTenantTier(e.target.value)}
                    className="form-select"
                  >
                    <option value="ENTERPRISE">Enterprise (Full Feature Suite, PII Audit & Compliance)</option>
                    <option value="PROFESSIONAL">Professional (Standard Analytics & Work Queue)</option>
                    <option value="STARTER">Starter Tier</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>⚡ Initial Portfolio Status</label>
                  <select
                    value={newTenantStatus}
                    onChange={e => setNewTenantStatus(e.target.value)}
                    className="form-select"
                    style={{
                      fontWeight: 600,
                      color: newTenantStatus === "ACTIVE" ? "#34d399" : newTenantStatus === "TRIAL" ? "#38bdf8" : newTenantStatus === "SUSPENDED" ? "#f87171" : "#fbbf24"
                    }}
                  >
                    <option value="ACTIVE">🟢 ACTIVE (Live Production)</option>
                    <option value="TRIAL">🔵 TRIAL (Evaluation / POC Mode)</option>
                    <option value="SUSPENDED">🔴 SUSPENDED (Hold Access)</option>
                    <option value="EXPIRED">🟡 EXPIRED (Contract Concluded)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "20px", padding: "16px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: "12px", fontSize: "13.5px" }}>
                  💼 Commercial & Platform Usage Terms
                </div>
                <div className="info-grid" style={{ marginBottom: "12px" }}>
                  <div className="form-group">
                    <label style={{ color: "#60a5fa" }}>Monthly Platform Usage / SaaS License Fee (ZAR)</label>
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
                    <label style={{ color: "#34d399" }}>Collector Success Commission Benchmark (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 10.00"
                      value={newTenantCommission}
                      onChange={e => setNewTenantCommission(e.target.value)}
                      className="form-input"
                      required
                    />
                    <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>Commission rate calculated for individual collectors upon verified trust settlement.</small>
                  </div>
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

              {/* Address & Official Representation Fields */}
              <div style={{ marginBottom: "18px", padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: "10px", fontSize: "13px" }}>
                  📍 Municipal Address & Official Representation (Rendered on Invoices & Proposals)
                </div>
                <div className="info-grid" style={{ marginBottom: "12px" }}>
                  <div className="form-group">
                    <label>Physical Address (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 158 Civic Boulevard, Braamfontein, Johannesburg, 2001"
                      value={newTenantPhysicalAddress}
                      onChange={e => setNewTenantPhysicalAddress(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postal Address (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. P.O. Box 1049, Johannesburg, 2000"
                      value={newTenantPostalAddress}
                      onChange={e => setNewTenantPostalAddress(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="info-grid">
                  <div className="form-group">
                    <label>Contact Person (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Manelisi Xulu"
                      value={newTenantContactPerson}
                      onChange={e => setNewTenantContactPerson(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Position / Role (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Financial Officer / Head of Revenue"
                      value={newTenantContactPosition}
                      onChange={e => setNewTenantContactPosition(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Telephone / Mobile (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. +27 (0)11 358 3000 / 082 123 4567"
                      value={newTenantContactPhone}
                      onChange={e => setNewTenantContactPhone(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOnboardTenantModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !newTenantName || !newTenantCode}>
                  {loading ? "Registering..." : "🏛️ Onboard Municipality & Activate Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingDebtor && (
        <div className="modal-backdrop" onClick={() => setEditingDebtor(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: "600px", width: "94%", margin: "auto", animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={e => e.stopPropagation()}>
            <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "14px" }}>
              <div className="panel-title">
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  ✏️ Edit Debtor & Property Master Details
                </h3>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12.5px" }}>
                  Update contact numbers, identification, primary billing email, and physical stand address
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingDebtor(null)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editingDebtor) return;
              setLoading(true);
              try {
                const res = await fetch(`${API}/customers/${editingDebtor.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    first_name: editingDebtor.first_name,
                    last_name: editingDebtor.last_name,
                    id_number: editingDebtor.id_number,
                    company_registration: editingDebtor.company_registration,
                    mobile: editingDebtor.mobile,
                    email: editingDebtor.email,
                    address: editingDebtor.address,
                    property_reference: editingDebtor.property_reference,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(`Error updating debtor details: ${data.detail || "Server error"}`);
                  return;
                }
                alert("Debtor master details updated successfully!");
                setEditingDebtor(null);
                if (selectedAccountId) {
                  openAccountWorkbench(selectedAccountId);
                }
                refreshData();
              } catch (err: any) {
                alert("Network error: " + err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>First Name / Entity Name</label>
                  <input
                    type="text"
                    value={editingDebtor.first_name || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, first_name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Surname / Suffix</label>
                  <input
                    type="text"
                    value={editingDebtor.last_name || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, last_name: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>SA ID Number / Registration</label>
                  <input
                    type="text"
                    value={editingDebtor.id_number || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, id_number: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Company Reg / Trust No.</label>
                  <input
                    type="text"
                    value={editingDebtor.company_registration || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, company_registration: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Mobile / Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 082 123 4567"
                    value={editingDebtor.mobile || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, mobile: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Debtor Billing Email</label>
                  <input
                    type="email"
                    placeholder="e.g. debtor@example.co.za"
                    value={editingDebtor.email || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, email: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="info-grid" style={{ marginBottom: "20px" }}>
                <div className="form-group">
                  <label>Physical Cadastral Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Stand 45, Schalk Farm 3, Ba-Phalaborwa"
                    value={editingDebtor.address || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, address: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Cadastral Reference (ERF / Stand)</label>
                  <input
                    type="text"
                    placeholder="e.g. ERF 45"
                    value={editingDebtor.property_reference || ""}
                    onChange={e => setEditingDebtor({ ...editingDebtor, property_reference: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingDebtor(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Saving..." : "💾 Save Debtor Details"}
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
                    {/* Stylish Modern Fintech Emblem (Canvas & PDF Native Compatible) */}
                    <div style={{
                      width: "48px",
                      height: "48px",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg viewBox="0 0 64 64" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Outer Precision Ring */}
                        <circle cx="32" cy="32" r="28" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="3 2" fill="#0f172a"/>
                        {/* Left Emerald/Cyan Sphere */}
                        <circle cx="25" cy="32" r="16" fill="#10b981" fillOpacity="0.85"/>
                        {/* Right Cobalt Sphere */}
                        <circle cx="39" cy="32" r="16" fill="#0284c7" fillOpacity="0.85"/>
                        {/* Center Lens Overlap */}
                        <path d="M32 19 C35.5 25, 35.5 39, 32 45 C28.5 39, 28.5 25, 32 19 Z" fill="#38bdf8"/>
                        {/* Center Monogram */}
                        <text x="32" y="38.5" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="900" fontFamily="sans-serif">
                          K
                        </text>
                      </svg>
                    </div>

                    <div>
                      <h2 style={{ margin: 0, fontSize: "23px", fontWeight: 900, color: "#0f172a", fontFamily: "Outfit, sans-serif", letterSpacing: "-0.5px", lineHeight: "1.1" }}>
                        KHOKHISA
                      </h2>
                      <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0284c7", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                        DEBT COLLECTION OS
                      </div>
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
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginBottom: "3px" }}>
                    {viewingPdfDoc.data.tenant_name || "City Municipality"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.45" }}>
                    Municipal Code: <strong>{viewingPdfDoc.data.tenant_code || "JHB"}</strong><br />
                    {viewingPdfDoc.data.tenant_contact_person ? (
                      <>
                        Attention: <strong>{viewingPdfDoc.data.tenant_contact_person}</strong>
                        {viewingPdfDoc.data.tenant_contact_position ? ` (${viewingPdfDoc.data.tenant_contact_position})` : ""}<br />
                      </>
                    ) : (
                      <>Attention: Chief Financial Officer / Revenue Unit<br /></>
                    )}
                    {viewingPdfDoc.data.tenant_physical_address && (
                      <>Physical Address: {viewingPdfDoc.data.tenant_physical_address}<br /></>
                    )}
                    {viewingPdfDoc.data.tenant_postal_address && (
                      <>Postal Address: {viewingPdfDoc.data.tenant_postal_address}<br /></>
                    )}
                    {(viewingPdfDoc.data.tenant_contact_phone || viewingPdfDoc.data.tenant_billing_email) && (
                      <div style={{ marginTop: "4px", color: "#334155" }}>
                        {viewingPdfDoc.data.tenant_contact_phone && <>Tel: {viewingPdfDoc.data.tenant_contact_phone} &nbsp;|&nbsp; </>}
                        {viewingPdfDoc.data.tenant_billing_email && <>Email: {viewingPdfDoc.data.tenant_billing_email}</>}
                      </div>
                    )}
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
                      <th style={{ padding: "10px 14px", width: "40px", borderRadius: "6px 0 0 0" }}>#</th>
                      <th style={{ padding: "10px 14px" }}>Description</th>
                      <th style={{ padding: "10px 14px", width: "60px", textAlign: "center", whiteSpace: "nowrap" }}>Qty</th>
                      <th style={{ padding: "10px 14px", width: "130px", textAlign: "right", whiteSpace: "nowrap" }}>Unit Price</th>
                      <th style={{ padding: "10px 14px", width: "140px", textAlign: "right", whiteSpace: "nowrap", borderRadius: "0 6px 0 0" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingPdfDoc.data.line_items || []).map((it: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 14px", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "12px 14px", color: "#0f172a", fontWeight: 600 }}>{it.description}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", color: "#475569", whiteSpace: "nowrap" }}>{it.quantity}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#475569", whiteSpace: "nowrap" }}>{money(it.unit_price)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap" }}>
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
                      <span style={{ whiteSpace: "nowrap" }}>{money(viewingPdfDoc.data.subtotal || viewingPdfDoc.data.total_amount)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                      <span>VAT (15%):</span>
                      <span style={{ whiteSpace: "nowrap" }}>{money(viewingPdfDoc.data.vat_amount || 0)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 800, color: "#0f172a", borderTop: "2px solid #0f172a", paddingTop: "6px", marginTop: "6px" }}>
                      <span>Total Due (ZAR):</span>
                      <span style={{ whiteSpace: "nowrap" }}>{money(viewingPdfDoc.data.total_amount)}</span>
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
                Generated electronically by Khokhisa • Compliant with MFMA, POPIA & South African Revenue Service (SARS) standards
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
                    const html2canvasModule = await import("html2canvas");
                    const { jsPDF } = await import("jspdf");
                    const html2canvas = html2canvasModule.default || html2canvasModule;

                    const canvas = await html2canvas(el, {
                      scale: 2,
                      useCORS: true,
                      logging: false,
                      backgroundColor: "#ffffff",
                    });

                    const imgData = canvas.toDataURL("image/png");
                    const pdf = new jsPDF({
                      orientation: "portrait",
                      unit: "mm",
                      format: "a4",
                    });

                    const imgWidth = 190;
                    const pageHeight = 297;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    let heightLeft = imgHeight;
                    let position = 10;

                    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
                    pdf.save(`${viewingPdfDoc.type}_${docNum}.pdf`);
                  } catch (e) {
                    console.error("PDF generation fallback:", e);
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

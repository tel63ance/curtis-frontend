// app/finance/dashboard.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { BASE_URL } from "../../config";

export default function FinanceDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [financeManagerId, setFinanceManagerId] = useState(null);
  const [activeTab, setActiveTab] = useState("payments");

  // Payments state
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");

  // Payment action modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  // Invoices state (expenses to suppliers)
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");

  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceRejectionReason, setInvoiceRejectionReason] = useState("");

  // Financial stats
  const [stats, setStats] = useState({
    // Income (payments)
    totalPayments: 0,
    totalApprovedIncome: 0,
    totalPendingIncome: 0,
    totalRejectedIncome: 0,
    bookingFees: 0,
    bookingFeesApproved: 0,
    bookingFeesPending: 0,
    normalPayments: 0,
    normalPaymentsApproved: 0,
    normalPaymentsPending: 0,

    // Expenses (invoices)
    totalInvoices: 0,
    totalExpenses: 0,
    unpaidInvoices: 0,
    unpaidExpenses: 0,
    paidInvoices: 0,
    paidExpenses: 0,
    partialInvoices: 0,
    partialExpenses: 0,

    // Net position (approved income - paid expenses)
    netBalance: 0,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (financeManagerId) {
      fetchPayments();
      fetchInvoices();
      fetchSuppliers();
    }
  }, [financeManagerId]);

  // Filter payments when dependencies change
  useEffect(() => {
    let filtered = payments;

    if (paymentFilter !== "all") {
      if (paymentFilter === "booking_fee") {
        filtered = filtered.filter((p) => p.payment_type === "booking_fee");
      } else if (paymentFilter === "normal_payment") {
        filtered = filtered.filter((p) => p.payment_type === "normal_payment");
      } else if (paymentFilter === "pending") {
        filtered = filtered.filter((p) => p.status === "pending");
      } else if (paymentFilter === "approved") {
        filtered = filtered.filter((p) => p.status === "approved");
      } else if (paymentFilter === "rejected") {
        filtered = filtered.filter((p) => p.status === "rejected");
      }
    }

    if (paymentSearchQuery.trim() !== "") {
      const query = paymentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.payment_id?.toLowerCase().includes(query) ||
          p.customer_id?.toLowerCase().includes(query) ||
          p.customer_name?.toLowerCase().includes(query) ||
          p.reference_code?.toLowerCase().includes(query) ||
          p.booking_id?.toLowerCase().includes(query),
      );
    }

    setFilteredPayments(filtered);
  }, [payments, paymentFilter, paymentSearchQuery]);

  // Filter invoices when dependencies change
  useEffect(() => {
    let filtered = invoices;

    if (invoiceFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === invoiceFilter);
    }

    if (invoiceSearchQuery.trim() !== "") {
      const query = invoiceSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_id?.toLowerCase().includes(query) ||
          inv.supplier_id?.toLowerCase().includes(query) ||
          inv.supplier_name?.toLowerCase().includes(query),
      );
    }

    setFilteredInvoices(filtered);
  }, [invoices, invoiceFilter, invoiceSearchQuery]);

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (!storedUser) {
        router.replace("/login");
        return;
      }

      const user = JSON.parse(storedUser);
      const id = user.id || user.user_id;
      setUserData(user);
      setFinanceManagerId(id);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async () => {
    try {
      return await AsyncStorage.getItem("token");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  };

  // ============== FETCH PAYMENTS ==============
  const fetchPayments = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${BASE_URL}/api/payments/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        return;
      }

      const data = await response.json();

      const paymentsList = Array.isArray(data) ? data : [];

      setPayments(paymentsList);
      calculatePaymentStats(paymentsList);
    } catch (error) {
      console.error("❌ Error fetching payments:", error);
      Alert.alert("Error", "Failed to fetch payments");
    }
  };

  // ============== FETCH INVOICES ==============
  const fetchInvoices = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${BASE_URL}/api/invoices`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        return;
      }

      const data = await response.json();

      // Handle response format (might be { invoices, count } or direct array)
      const invoicesList = Array.isArray(data)
        ? data
        : data.invoices && Array.isArray(data.invoices)
          ? data.invoices
          : [];

      console.log(`📄 Received ${invoicesList.length} invoices`);
      setInvoices(invoicesList);
      calculateInvoiceStats(invoicesList);
    } catch (error) {
      console.error("❌ Error fetching invoices:", error);
      Alert.alert("Error", "Failed to fetch invoices");
    }
  };

  // ============== FETCH SUPPLIERS ==============
  const fetchSuppliers = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${BASE_URL}/api/admin/users?role=supplier`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        console.log("No suppliers endpoint available");
        setSuppliers([]);
        return;
      }

      const data = await response.json();

      let suppliersArray = [];
      if (Array.isArray(data)) {
        suppliersArray = data;
      } else if (data.users && Array.isArray(data.users)) {
        suppliersArray = data.users;
      } else if (data.data && Array.isArray(data.data)) {
        suppliersArray = data.data;
      }

      setSuppliers(suppliersArray);
    } catch (error) {
      console.error("❌ Error fetching suppliers:", error);
      setSuppliers([]);
    }
  };

  // ============== CALCULATE PAYMENT STATS ==============
  const calculatePaymentStats = (paymentsList) => {
    const totalPayments = paymentsList.length;

    const approvedPayments = paymentsList.filter(
      (p) => p.status === "approved",
    );
    const totalApprovedIncome = approvedPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );

    const pendingPayments = paymentsList.filter((p) => p.status === "pending");
    const totalPendingIncome = pendingPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );

    const rejectedPayments = paymentsList.filter(
      (p) => p.status === "rejected",
    );
    const totalRejectedIncome = rejectedPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );

    const bookingFees = paymentsList.filter(
      (p) => p.payment_type === "booking_fee",
    );
    const bookingFeesApproved = bookingFees.filter(
      (p) => p.status === "approved",
    ).length;
    const bookingFeesPending = bookingFees.filter(
      (p) => p.status === "pending",
    ).length;

    const normalPayments = paymentsList.filter(
      (p) => p.payment_type === "normal_payment",
    );
    const normalPaymentsApproved = normalPayments.filter(
      (p) => p.status === "approved",
    ).length;
    const normalPaymentsPending = normalPayments.filter(
      (p) => p.status === "pending",
    ).length;

    setStats((prev) => ({
      ...prev,
      totalPayments,
      totalApprovedIncome,
      totalPendingIncome,
      totalRejectedIncome,
      bookingFees: bookingFees.length,
      bookingFeesApproved,
      bookingFeesPending,
      normalPayments: normalPayments.length,
      normalPaymentsApproved,
      normalPaymentsPending,
    }));
  };

  // ============== CALCULATE INVOICE STATS ==============
  const calculateInvoiceStats = (invoicesList) => {
    const totalInvoices = invoicesList.length;

    const totalExpenses = invoicesList.reduce(
      (sum, inv) => sum + (parseFloat(inv.amount) || 0),
      0,
    );

    const unpaidInvoices = invoicesList.filter(
      (inv) => inv.status === "unpaid",
    );
    const paidInvoices = invoicesList.filter((inv) => inv.status === "paid");
    const partialInvoices = invoicesList.filter(
      (inv) => inv.status === "partial",
    );

    const unpaidExpenses = unpaidInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.amount) || 0),
      0,
    );

    const paidExpenses = paidInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.amount) || 0),
      0,
    );

    const partialExpenses = partialInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.amount) || 0),
      0,
    );

    setStats((prev) => ({
      ...prev,
      totalInvoices,
      totalExpenses,
      unpaidInvoices: unpaidInvoices.length,
      unpaidExpenses,
      paidInvoices: paidInvoices.length,
      paidExpenses,
      partialInvoices: partialInvoices.length,
      partialExpenses,
      // Net balance = approved income - paid expenses
      netBalance: prev.totalApprovedIncome - paidExpenses,
    }));
  };

  // ============== PAYMENT ACTIONS ==============
  const handleApprovePress = (payment) => {
    setSelectedPayment(payment);
    setActionType("approve");
    setPaymentModalVisible(true);
  };

  const handleRejectPress = (payment) => {
    setSelectedPayment(payment);
    setActionType("reject");
    setRejectionReason("");
    setPaymentModalVisible(true);
  };

  const confirmPaymentAction = async () => {
    if (!selectedPayment) return;

    if (actionType === "reject" && !rejectionReason.trim()) {
      Alert.alert("Error", "Please enter a reason for rejection");
      return;
    }

    setProcessingId(selectedPayment.payment_id);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const status = actionType === "approve" ? "approved" : "rejected";

      const response = await fetch(
        `${BASE_URL}/api/payments/${selectedPayment.payment_id}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", `Payment ${status} successfully`, [
          {
            text: "OK",
            onPress: () => {
              setPaymentModalVisible(false);
              fetchPayments();
            },
          },
        ]);
      } else {
        throw new Error(result.error || `Failed to ${actionType} payment`);
      }
    } catch (error) {
      console.error(`❌ Error ${actionType}ing payment:`, error);
      Alert.alert("Error", error.message || `Failed to ${actionType} payment`);
    } finally {
      setProcessingId(null);
    }
  };

  // ============== INVOICE ACTIONS ==============
  const markInvoiceAsPaid = async (invoice) => {
    Alert.alert(
      "Confirm Payment",
      `Mark invoice as paid?\n\nInvoice ID: ${invoice.invoice_id}\nAmount: ${formatCurrency(invoice.amount)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Mark Paid",
          onPress: async () => {
            setProcessingId(invoice.invoice_id);
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(
                `${BASE_URL}/api/invoices/${invoice.invoice_id}/pay`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                },
              );

              const result = await response.json();

              if (response.ok) {
                Alert.alert("Success", "Invoice marked as paid");
                await Promise.all([fetchInvoices(), fetchPayments()]);
              } else {
                throw new Error(result.message || "Failed to mark as paid");
              }
            } catch (error) {
              console.error("❌ Error marking invoice as paid:", error);
              Alert.alert("Error", error.message || "Failed to mark as paid");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const updateInvoiceStatus = (invoice) => {
    Alert.alert(
      "Update Invoice Status",
      "Select new status:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unpaid",
          onPress: () => updateStatus(invoice, "unpaid"),
        },
        {
          text: "Partial",
          onPress: () => updateStatus(invoice, "partial"),
        },
        {
          text: "Paid",
          onPress: () => updateStatus(invoice, "paid"),
        },
      ],
      { cancelable: true },
    );
  };

  const updateStatus = async (invoice, status) => {
    setProcessingId(invoice.invoice_id);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${BASE_URL}/api/invoices/${invoice.invoice_id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", `Invoice status updated to ${status}`);
        await Promise.all([fetchInvoices(), fetchPayments()]);
      } else {
        throw new Error(result.message || "Failed to update status");
      }
    } catch (error) {
      console.error("❌ Error updating invoice status:", error);
      Alert.alert("Error", error.message || "Failed to update status");
    } finally {
      setProcessingId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPayments(), fetchInvoices(), fetchSuppliers()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/login");
        },
      },
    ]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "KSh 0.00";
    return `KSh ${parseFloat(amount).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
      case "paid":
        return "#10b981";
      case "pending":
      case "unpaid":
        return "#f59e0b";
      case "partial":
        return "#3b82f6";
      case "rejected":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
      case "paid":
        return "checkmark-circle-outline";
      case "pending":
      case "unpaid":
        return "time-outline";
      case "partial":
        return "sync-outline";
      case "rejected":
        return "close-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  // ============== RENDER PAYMENT ITEM ==============
  const renderPaymentItem = ({ item }) => {
    const canApprove = item.status === "pending";
    const canReject = item.status === "pending";

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionIdContainer}>
            <Ionicons name="cash-outline" size={16} color="#10b981" />
            <Text style={styles.transactionId}>Payment: {item.payment_id}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.status)}20` },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status)}
              size={12}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status?.toUpperCase() || "PENDING"}
            </Text>
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={[styles.detailValue, styles.incomeValue]}>
              +{formatCurrency(item.amount)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Booking ID:</Text>
            <Text style={styles.detailValue}>{item.booking_id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer:</Text>
            <Text style={styles.detailValue}>
              {item.customer_name || item.customer_id}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>
              {item.payment_type === "booking_fee"
                ? "Booking Fee"
                : "Normal Payment"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference:</Text>
            <Text style={styles.detailValue}>{item.reference_code}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </View>

        {canApprove && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprovePress(item)}
              disabled={processingId === item.payment_id}
            >
              {processingId === item.payment_id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleRejectPress(item)}
              disabled={processingId === item.payment_id}
            >
              {processingId === item.payment_id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {item.status === "approved" && (
          <View style={styles.approvalInfo}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={styles.approvalText}>Approved</Text>
          </View>
        )}
      </View>
    );
  };

  // ============== RENDER INVOICE ITEM ==============
  const renderInvoiceItem = ({ item }) => {
    const canMarkPaid = item.status === "unpaid";
    const canUpdate = true;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionIdContainer}>
            <Ionicons name="document-text" size={16} color="#ef4444" />
            <Text style={styles.transactionId}>Invoice: {item.invoice_id}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.status)}20` },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status)}
              size={12}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status?.toUpperCase() || "UNPAID"}
            </Text>
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={[styles.detailValue, styles.expenseValue]}>
              -{formatCurrency(item.amount)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Supplier ID:</Text>
            <Text style={styles.detailValue}>{item.supplier_id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Supply ID:</Text>
            <Text style={styles.detailValue}>{item.supply_id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          {item.paid_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Paid At:</Text>
              <Text style={styles.detailValue}>{formatDate(item.paid_at)}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          {canMarkPaid && (
            <TouchableOpacity
              style={[styles.actionButton, styles.paidButton]}
              onPress={() => markInvoiceAsPaid(item)}
              disabled={processingId === item.invoice_id}
            >
              {processingId === item.invoice_id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Mark Paid</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canUpdate && (
            <TouchableOpacity
              style={[styles.actionButton, styles.updateButton]}
              onPress={() => updateInvoiceStatus(item)}
              disabled={processingId === item.invoice_id}
            >
              {processingId === item.invoice_id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Update</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {item.status === "paid" && (
          <View style={styles.approvalInfo}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={styles.approvalText}>Paid</Text>
          </View>
        )}

        {item.status === "partial" && (
          <View style={[styles.approvalInfo, { backgroundColor: "#3b82f620" }]}>
            <Ionicons name="sync-outline" size={16} color="#3b82f6" />
            <Text style={[styles.approvalText, { color: "#3b82f6" }]}>
              Partial Payment
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ============== RENDER STATS CARD ==============
  const StatCard = ({ title, count, amount, color, icon, isIncome = true }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={[styles.statAmount, { color }]}>
        {isIncome ? "+" : "-"}
        {formatCurrency(amount)}
      </Text>
    </View>
  );

  // ============== RENDER EMPTY STATE ==============
  const renderEmptyState = (type) => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={type === "payments" ? "cash-outline" : "document-text-outline"}
        size={64}
        color="#cbd5e1"
      />
      <Text style={styles.emptyTitle}>
        No {type === "payments" ? "Payments" : "Invoices"} Found
      </Text>
      <Text style={styles.emptyText}>
        {type === "payments"
          ? paymentSearchQuery
            ? "No payments match your search"
            : paymentFilter !== "all"
              ? `No ${paymentFilter} payments found`
              : "Customer payments will appear here"
          : invoiceSearchQuery
            ? "No invoices match your search"
            : invoiceFilter !== "all"
              ? `No ${invoiceFilter} invoices found`
              : "Supplier invoices will appear here when supplies are approved"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading finance dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.title}>Finance Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2E7D32"]}
            tintColor="#2E7D32"
          />
        }
      >
        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <View>
            <Text style={styles.welcomeText}>Welcome,</Text>
            <Text style={styles.userName}>
              {userData?.name || "Finance Manager"}
            </Text>
          </View>
          <View style={styles.rolePill}>
            <Ionicons name="wallet-outline" size={16} color="#2E7D32" />
            <Text style={styles.roleText}>Finance Manager</Text>
          </View>
        </View>

        {/* Net Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons
              name="wallet"
              size={24}
              color={stats.netBalance >= 0 ? "#10b981" : "#ef4444"}
            />
            <Text style={styles.balanceTitle}>Net Balance</Text>
          </View>
          <Text
            style={[
              styles.balanceAmount,
              { color: stats.netBalance >= 0 ? "#10b981" : "#ef4444" },
            ]}
          >
            {stats.netBalance >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(stats.netBalance))}
          </Text>
          <View style={styles.balanceBreakdown}>
            <Text style={styles.balanceIncome}>
              Income: +{formatCurrency(stats.totalApprovedIncome)}
            </Text>
            <Text style={styles.balanceExpense}>
              Expenses: -{formatCurrency(stats.paidExpenses)}
            </Text>
          </View>
        </View>

        {/* Income Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>
            Income Overview (Customer Payments)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statsRow}>
              <StatCard
                title="Total Payments"
                count={stats.totalPayments}
                amount={
                  stats.totalApprovedIncome +
                  stats.totalPendingIncome +
                  stats.totalRejectedIncome
                }
                color="#2E7D32"
                icon="cash"
                isIncome={true}
              />
              <StatCard
                title="Approved"
                count={stats.bookingFeesApproved + stats.normalPaymentsApproved}
                amount={stats.totalApprovedIncome}
                color="#10b981"
                icon="checkmark-circle"
                isIncome={true}
              />
              <StatCard
                title="Pending"
                count={stats.bookingFeesPending + stats.normalPaymentsPending}
                amount={stats.totalPendingIncome}
                color="#f59e0b"
                icon="time"
                isIncome={true}
              />
              <StatCard
                title="Rejected"
                count={
                  stats.bookingFees +
                  stats.normalPayments -
                  stats.bookingFeesApproved -
                  stats.normalPaymentsApproved -
                  stats.bookingFeesPending -
                  stats.normalPaymentsPending
                }
                amount={stats.totalRejectedIncome}
                color="#ef4444"
                icon="close-circle"
                isIncome={true}
              />
            </View>
          </ScrollView>
        </View>

        {/* Expense Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>
            Expense Overview (Supplier Invoices)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statsRow}>
              <StatCard
                title="Total Invoices"
                count={stats.totalInvoices}
                amount={stats.totalExpenses}
                color="#2E7D32"
                icon="document-text"
                isIncome={false}
              />
              <StatCard
                title="Unpaid"
                count={stats.unpaidInvoices}
                amount={stats.unpaidExpenses}
                color="#f59e0b"
                icon="time"
                isIncome={false}
              />
              <StatCard
                title="Partial"
                count={stats.partialInvoices}
                amount={stats.partialExpenses}
                color="#3b82f6"
                icon="sync"
                isIncome={false}
              />
              <StatCard
                title="Paid"
                count={stats.paidInvoices}
                amount={stats.paidExpenses}
                color="#10b981"
                icon="checkmark-circle"
                isIncome={false}
              />
            </View>
          </ScrollView>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "payments" && styles.activeTab]}
            onPress={() => setActiveTab("payments")}
          >
            <Ionicons
              name="cash-outline"
              size={20}
              color={activeTab === "payments" ? "#2E7D32" : "#64748b"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "payments" && styles.activeTabText,
              ]}
            >
              Customer Payments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "invoices" && styles.activeTab]}
            onPress={() => setActiveTab("invoices")}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={activeTab === "invoices" ? "#2E7D32" : "#64748b"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "invoices" && styles.activeTabText,
              ]}
            >
              Supplier Invoices
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conditional Content Based on Tab */}
        {activeTab === "payments" ? (
          /* Payments Section */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Payments</Text>

            {/* Payment Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterTabs}
            >
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  paymentFilter === "all" && styles.activeFilterTab,
                ]}
                onPress={() => setPaymentFilter("all")}
              >
                <Text
                  style={[
                    styles.filterText,
                    paymentFilter === "all" && styles.activeFilterText,
                  ]}
                >
                  All ({stats.totalPayments})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  paymentFilter === "pending" && styles.activeFilterTab,
                ]}
                onPress={() => setPaymentFilter("pending")}
              >
                <Text
                  style={[
                    styles.filterText,
                    paymentFilter === "pending" && styles.activeFilterText,
                  ]}
                >
                  Pending (
                  {stats.bookingFeesPending + stats.normalPaymentsPending})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  paymentFilter === "approved" && styles.activeFilterTab,
                ]}
                onPress={() => setPaymentFilter("approved")}
              >
                <Text
                  style={[
                    styles.filterText,
                    paymentFilter === "approved" && styles.activeFilterText,
                  ]}
                >
                  Approved (
                  {stats.bookingFeesApproved + stats.normalPaymentsApproved})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  paymentFilter === "booking_fee" && styles.activeFilterTab,
                ]}
                onPress={() => setPaymentFilter("booking_fee")}
              >
                <Text
                  style={[
                    styles.filterText,
                    paymentFilter === "booking_fee" && styles.activeFilterText,
                  ]}
                >
                  Booking Fees ({stats.bookingFees})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  paymentFilter === "normal_payment" && styles.activeFilterTab,
                ]}
                onPress={() => setPaymentFilter("normal_payment")}
              >
                <Text
                  style={[
                    styles.filterText,
                    paymentFilter === "normal_payment" &&
                      styles.activeFilterText,
                  ]}
                >
                  Normal ({stats.normalPayments})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Payment Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search payments..."
                placeholderTextColor="#94a3b8"
                value={paymentSearchQuery}
                onChangeText={setPaymentSearchQuery}
              />
              {paymentSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setPaymentSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Payments List */}
            <FlatList
              data={filteredPayments}
              renderItem={renderPaymentItem}
              keyExtractor={(item) =>
                item.payment_id || Math.random().toString()
              }
              scrollEnabled={false}
              contentContainerStyle={styles.transactionsList}
              ListEmptyComponent={renderEmptyState("payments")}
            />
          </View>
        ) : (
          /* Invoices Section */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supplier Invoices</Text>

            {/* Invoice Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterTabs}
            >
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  invoiceFilter === "all" && styles.activeFilterTab,
                ]}
                onPress={() => setInvoiceFilter("all")}
              >
                <Text
                  style={[
                    styles.filterText,
                    invoiceFilter === "all" && styles.activeFilterText,
                  ]}
                >
                  All ({stats.totalInvoices})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  invoiceFilter === "unpaid" && styles.activeFilterTab,
                ]}
                onPress={() => setInvoiceFilter("unpaid")}
              >
                <Text
                  style={[
                    styles.filterText,
                    invoiceFilter === "unpaid" && styles.activeFilterText,
                  ]}
                >
                  Unpaid ({stats.unpaidInvoices})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  invoiceFilter === "partial" && styles.activeFilterTab,
                ]}
                onPress={() => setInvoiceFilter("partial")}
              >
                <Text
                  style={[
                    styles.filterText,
                    invoiceFilter === "partial" && styles.activeFilterText,
                  ]}
                >
                  Partial ({stats.partialInvoices})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  invoiceFilter === "paid" && styles.activeFilterTab,
                ]}
                onPress={() => setInvoiceFilter("paid")}
              >
                <Text
                  style={[
                    styles.filterText,
                    invoiceFilter === "paid" && styles.activeFilterText,
                  ]}
                >
                  Paid ({stats.paidInvoices})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Invoice Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search invoices..."
                placeholderTextColor="#94a3b8"
                value={invoiceSearchQuery}
                onChangeText={setInvoiceSearchQuery}
              />
              {invoiceSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setInvoiceSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Invoices List */}
            <FlatList
              data={filteredInvoices}
              renderItem={renderInvoiceItem}
              keyExtractor={(item) =>
                item.invoice_id || Math.random().toString()
              }
              scrollEnabled={false}
              contentContainerStyle={styles.transactionsList}
              ListEmptyComponent={renderEmptyState("invoices")}
            />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Nairobi Botanica Finance Management
          </Text>
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>
      </ScrollView>

      {/* ============== PAYMENT ACTION MODAL ============== */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === "approve"
                  ? "Approve Payment"
                  : "Reject Payment"}
              </Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                disabled={processingId === selectedPayment?.payment_id}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedPayment && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.modalInvoiceInfo}>
                  <Text style={styles.modalInvoiceId}>
                    Payment: {selectedPayment.payment_id}
                  </Text>
                  <Text style={styles.modalInvoiceItem}>
                    Amount: {formatCurrency(selectedPayment.amount)}
                  </Text>
                  <Text style={styles.modalInvoiceSupplier}>
                    Customer:{" "}
                    {selectedPayment.customer_name ||
                      selectedPayment.customer_id}
                  </Text>
                  <Text style={styles.modalInvoiceSupplier}>
                    Reference: {selectedPayment.reference_code}
                  </Text>
                </View>

                {actionType === "reject" && (
                  <View style={styles.modalForm}>
                    <Text style={styles.modalLabel}>
                      Reason for Rejection *
                    </Text>
                    <TextInput
                      style={[styles.modalInput, styles.textArea]}
                      placeholder="Enter rejection reason"
                      placeholderTextColor="#94a3b8"
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                      multiline
                      numberOfLines={4}
                      editable={processingId !== selectedPayment?.payment_id}
                    />
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setPaymentModalVisible(false)}
                    disabled={processingId === selectedPayment?.payment_id}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      actionType === "approve"
                        ? styles.modalApproveButton
                        : styles.modalRejectButton,
                      ((actionType === "reject" && !rejectionReason.trim()) ||
                        processingId === selectedPayment?.payment_id) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={confirmPaymentAction}
                    disabled={
                      (actionType === "reject" && !rejectionReason.trim()) ||
                      processingId === selectedPayment?.payment_id
                    }
                  >
                    {processingId === selectedPayment?.payment_id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.modalRejectButtonText}>
                        {actionType === "approve"
                          ? "Confirm Approval"
                          : "Confirm Rejection"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  content: {
    flex: 1,
  },
  welcomeBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D3220",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2E7D32",
  },
  balanceCard: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 12,
  },
  balanceBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  balanceIncome: {
    fontSize: 14,
    color: "#10b981",
    fontWeight: "500",
  },
  balanceExpense: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
  },
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 16,
  },
  statCard: {
    width: 150,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  statTitle: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },
  statCount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: "#e8f5e9",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  activeTabText: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  filterTabs: {
    flexDirection: "row",
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "white",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  activeFilterTab: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  filterText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  activeFilterText: {
    color: "white",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    marginLeft: 8,
    marginRight: 8,
    padding: 0,
  },
  transactionsList: {
    gap: 8,
  },
  transactionCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  transactionIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  transactionId: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  transactionDetails: {
    gap: 4,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailLabel: {
    width: 80,
    fontSize: 12,
    color: "#64748b",
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  incomeValue: {
    color: "#10b981",
    fontWeight: "600",
  },
  expenseValue: {
    color: "#ef4444",
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 6,
    gap: 4,
  },
  approveButton: {
    backgroundColor: "#10b981",
  },
  paidButton: {
    backgroundColor: "#10b981",
  },
  updateButton: {
    backgroundColor: "#3b82f6",
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  approvalInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    backgroundColor: "#e8f5e9",
    borderRadius: 6,
    gap: 6,
  },
  approvalText: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 10,
    color: "#cbd5e1",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalContent: {
    padding: 20,
  },
  modalInvoiceInfo: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 4,
  },
  modalInvoiceId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  modalInvoiceItem: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  modalInvoiceSupplier: {
    fontSize: 12,
    color: "#64748b",
  },
  modalForm: {
    gap: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "#f1f5f9",
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  modalApproveButton: {
    backgroundColor: "#10b981",
  },
  modalRejectButton: {
    backgroundColor: "#ef4444",
  },
  modalRejectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

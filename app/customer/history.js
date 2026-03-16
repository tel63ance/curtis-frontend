// components/ServiceHistory.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Import BASE_URL from config
import { BASE_URL } from "../../config";

const ServiceHistory = ({ customerId }) => {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [payments, setPayments] = useState([]);

  // Booking Details Modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Receipt Modal
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Track confirmed bookings
  const [confirmedBookings, setConfirmedBookings] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    status: "",
    serviceType: "",
    startDate: null,
    endDate: null,
    searchTerm: "",
  });

  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Available service types from your enum
  const serviceTypes = [
    "Landscape Design",
    "Garden Maintenance",
    "Lawn Installation & Care",
    "Irrigation System Installation",
    "Hardscape Construction",
    "Outdoor Lighting Installation",
    "Tree Planting & Care",
    "Flower Bed Design",
    "Vertical Gardens / Green Walls",
    "Plant Nursery Supplies",
    "Deck & Pergola Construction",
    "Pond & Water Feature Installation",
    "Outdoor Furniture Design",
    "Pest & Disease Control",
    "Soil Testing & Fertilization",
    "Seasonal Garden Prep",
    "New Service Here",
  ];

  const statusOptions = [
    "pending",
    "approved",
    "in_progress",
    "completed",
    "cancelled",
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (customerId || userData?.id) {
      fetchBookings();
      fetchPayments();
    }
  }, [customerId, userData]);

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserData(user);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
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

  const fetchBookings = async () => {
    try {
      setError(null);
      const token = await getAuthToken();

      if (!token) {
        setError("Please login to view your bookings");
        setLoading(false);
        return;
      }

      const effectiveCustomerId = customerId || userData?.id;

      if (!effectiveCustomerId) {
        setError("Customer ID not found");
        setLoading(false);
        return;
      }

      // Fetch customer's specific bookings
      const response = await fetch(
        `${BASE_URL}/api/bookings/customer/${effectiveCustomerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bookings");
      }

      const data = await response.json();

      // Ensure data is an array
      const bookingsArray = Array.isArray(data) ? data : [];
      setBookings(bookingsArray);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const effectiveCustomerId = customerId || userData?.id;
      if (!effectiveCustomerId) return;

      const response = await fetch(
        `${BASE_URL}/api/payments/customer/${effectiveCustomerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setPayments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchBookings(), fetchPayments()]).finally(() =>
      setRefreshing(false),
    );
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(
        (booking) => booking.status === filters.status,
      );
    }

    // Filter by service type
    if (filters.serviceType) {
      filtered = filtered.filter(
        (booking) => booking.service_type === filters.serviceType,
      );
    }

    // Filter by search term (booking_id, location)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (booking) =>
          booking.booking_id?.toLowerCase().includes(searchLower) ||
          booking.location?.toLowerCase().includes(searchLower) ||
          booking.service_type?.toLowerCase().includes(searchLower),
      );
    }

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(
        (booking) => new Date(booking.preferred_date) >= filters.startDate,
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(
        (booking) => new Date(booking.preferred_date) <= filters.endDate,
      );
    }

    setFilteredBookings(filtered);
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      serviceType: "",
      startDate: null,
      endDate: null,
      searchTerm: "",
    });
  };

  const handleBookingPress = (booking) => {
    setSelectedBooking(booking);
    setDetailsModalVisible(true);
  };

  const handleMakePayment = (booking) => {
    // Navigate to payments screen with booking details
    router.push({
      pathname: "/customer/payments",
      params: {
        bookingId: booking.booking_id,
        amount: booking.valuation_amount || booking.booking_fee,
        serviceType: booking.service_type,
        paymentType: booking.valuation_amount
          ? "normal_payment"
          : "booking_fee",
        customerId: customerId || userData?.id,
        customerName: userData?.name || "",
        customerEmail: userData?.email || "",
      },
    });
  };

  const handleViewReceipt = (booking) => {
    // Find approved payments for this booking
    const approvedPayments = payments.filter(
      (p) => p.booking_id === booking.booking_id && p.status === "approved",
    );

    if (approvedPayments.length === 0) {
      Alert.alert("No Receipt", "No approved payments found for this booking.");
      return;
    }

    // If there are multiple payments, show the most recent one
    const latestPayment = approvedPayments.sort(
      (a, b) =>
        new Date(b.paid_at || b.created_at) -
        new Date(a.paid_at || a.created_at),
    )[0];

    setSelectedPayment({
      ...latestPayment,
      booking: booking,
    });
    setReceiptModalVisible(true);
  };

  const handleConfirmCompletion = (booking) => {
    // Add booking to confirmed list
    setConfirmedBookings((prev) => [...prev, booking.booking_id]);

    // Show success message
    Alert.alert(
      "Service Completed",
      `Thank you for confirming that the ${booking.service_type} service has been completed. We hope you're satisfied with our work!`,
      [{ text: "OK" }],
    );
  };

  const isBookingConfirmed = (bookingId) => {
    return confirmedBookings.includes(bookingId);
  };

  const generateReceiptHTML = (payment, booking) => {
    const paymentDate = payment.paid_at || payment.created_at;
    const formattedDate = new Date(paymentDate).toLocaleDateString("en-KE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const paymentType =
      payment.payment_type === "booking_fee"
        ? "Booking Fee"
        : "Service Payment (Valuation)";

    // Calculate total amount paid
    let totalPaid = payment.amount;
    let displayBreakdown = false;

    // For normal payments, the total should include both booking fee and valuation amount
    if (payment.payment_type === "normal_payment" && booking.valuation_amount) {
      totalPaid = (
        parseFloat(booking.booking_fee) + parseFloat(booking.valuation_amount)
      ).toFixed(2);
      displayBreakdown = true;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt</title>
          <style>
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .receipt-container {
              max-width: 800px;
              margin: 0 auto;
              background-color: white;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #1B5E20, #2E7D32);
              padding: 30px;
              color: white;
              text-align: center;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .tagline {
              font-size: 14px;
              opacity: 0.9;
              font-style: italic;
            }
            .receipt-title {
              background-color: #f5f5f5;
              padding: 15px;
              text-align: center;
              border-bottom: 1px solid #e0e0e0;
            }
            .receipt-title h2 {
              margin: 0;
              color: #1B5E20;
              font-size: 24px;
            }
            .receipt-title p {
              margin: 5px 0 0;
              color: #666;
              font-size: 14px;
            }
            .content {
              padding: 30px;
            }
            .company-info {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px dashed #e0e0e0;
            }
            .company-name {
              font-size: 20px;
              font-weight: bold;
              color: #1B5E20;
              margin-bottom: 5px;
            }
            .company-address {
              color: #666;
              font-size: 14px;
              line-height: 1.5;
            }
            .receipt-details {
              margin-bottom: 30px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #f0f0f0;
            }
            .detail-label {
              font-weight: 600;
              color: #555;
              width: 40%;
            }
            .detail-value {
              color: #333;
              width: 60%;
              text-align: right;
            }
            .breakdown-section {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin: 15px 0;
            }
            .breakdown-title {
              font-size: 16px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
            }
            .breakdown-row {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
            }
            .payment-status {
              margin-top: 20px;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
              font-weight: bold;
              font-size: 18px;
              background-color: #e8f5e9;
              color: #2E7D32;
            }
            .amount-highlight {
              font-size: 24px;
              font-weight: bold;
              color: #2E7D32;
            }
            .footer {
              background-color: #f9f9f9;
              padding: 20px;
              text-align: center;
              color: #888;
              font-size: 12px;
              border-top: 1px solid #e0e0e0;
            }
            .footer p {
              margin: 5px 0;
            }
            .watermark {
              text-align: center;
              color: #ccc;
              font-size: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="logo">🌿 Nairobi Botanica</div>
              <div class="tagline">Gardening Limited</div>
            </div>
            
            <div class="receipt-title">
              <h2>PAYMENT RECEIPT</h2>
              <p>Official Payment Acknowledgement</p>
            </div>
            
            <div class="content">
              <div class="company-info">
                <div class="company-name">Nairobi Botanica Gardening Limited</div>
                <div class="company-address">
                  Headquartered in Karen, Nairobi, Kenya<br>
                  Agriculture • Landscaping • Horticulture • Architecture • Maintenance<br>
                  Tel: +254 (0) 700 000 000 | Email: info@nairobbotanica.co.ke
                </div>
              </div>
              
              <div class="receipt-details">
                <div class="detail-row">
                  <span class="detail-label">Receipt Number:</span>
                  <span class="detail-value">RCT-${payment.payment_id}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment ID:</span>
                  <span class="detail-value">${payment.payment_id}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Booking ID:</span>
                  <span class="detail-value">${booking.booking_id}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Service Type:</span>
                  <span class="detail-value">${booking.service_type}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Customer Name:</span>
                  <span class="detail-value">${booking.customer_name || userData?.name || "N/A"}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Customer Email:</span>
                  <span class="detail-value">${booking.email || userData?.email || "N/A"}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Type:</span>
                  <span class="detail-value">${paymentType}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${payment.payment_method || "N/A"}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Reference Code:</span>
                  <span class="detail-value">${payment.reference_code || "N/A"}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Date:</span>
                  <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Service Location:</span>
                  <span class="detail-value">${booking.location}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Preferred Date:</span>
                  <span class="detail-value">${new Date(
                    booking.preferred_date,
                  ).toLocaleDateString("en-KE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</span>
                </div>
                
                ${
                  displayBreakdown
                    ? `
                  <div class="breakdown-section">
                    <div class="breakdown-title">Payment Breakdown</div>
                    <div class="breakdown-row">
                      <span>Booking Fee:</span>
                      <span>${formatCurrency(booking.booking_fee)}</span>
                    </div>
                    <div class="breakdown-row">
                      <span>Valuation Amount:</span>
                      <span>${formatCurrency(booking.valuation_amount)}</span>
                    </div>
                    <div class="breakdown-row" style="border-top: 2px solid #e0e0e0; margin-top: 10px; padding-top: 10px; font-weight: bold;">
                      <span>Total Service Cost:</span>
                      <span>${formatCurrency(totalPaid)}</span>
                    </div>
                  </div>
                `
                    : ""
                }
                
                <div class="detail-row" style="border-bottom: 2px solid #e0e0e0; margin-top: 10px;">
                  <span class="detail-label" style="font-size: 18px;">TOTAL PAID:</span>
                  <span class="detail-value amount-highlight">${formatCurrency(totalPaid)}</span>
                </div>
              </div>
              
              <div class="payment-status">
                ✅ PAYMENT APPROVED
              </div>
              
              <div style="text-align: center; margin-top: 20px;">
                <p style="color: #666;">Thank you for your business!</p>
                <p style="color: #666; font-size: 13px;">This is an electronically generated receipt. Valid without signature.</p>
              </div>
            </div>
            
            <div class="footer">
              <p>Nairobi Botanica Gardening Limited</p>
              <p>Headquartered in Karen, Nairobi, Kenya</p>
              <p>Leading pioneer in landscaping services within the region</p>
              <p>Professional • Innovative • Customer-Centric</p>
              <div class="watermark">
                <p>Receipt generated on ${new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const generateAndSharePDF = async () => {
    if (!selectedPayment || !selectedPayment.booking) return;

    setGeneratingPDF(true);
    try {
      const html = generateReceiptHTML(
        selectedPayment,
        selectedPayment.booking,
      );

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Share PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Payment Receipt",
          UTI: "com.adobe.pdf",
        });
      } else {
        // Fallback to sharing the URI
        await Share.share({
          message: `Payment Receipt for Booking ${selectedPayment.booking.booking_id}`,
          url: uri,
          title: "Payment Receipt",
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate receipt. Please try again.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "#ff9800",
      approved: "#2196f3",
      in_progress: "#4caf50",
      completed: "#8bc34a",
      cancelled: "#f44336",
    };
    return colors[status] || "#999";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "approved":
        return "checkmark-circle-outline";
      case "in_progress":
        return "construct-outline";
      case "completed":
        return "checkmark-done-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getStatusDescription = (status, hasValuation) => {
    switch (status) {
      case "pending":
        return "Awaiting approval from service manager";
      case "approved":
        return "Booking approved. Waiting for engineer assignment.";
      case "in_progress":
        return hasValuation
          ? "Valuation provided. Please complete payment."
          : "Engineer assigned. Valuation pending.";
      case "completed":
        return "Service completed successfully";
      case "cancelled":
        return "Booking was cancelled";
      default:
        return "";
    }
  };

  const checkPaymentApproved = (booking) => {
    const bookingPayments = payments.filter(
      (p) => p.booking_id === booking.booking_id && p.status === "approved",
    );
    return bookingPayments.length > 0;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return "KES 0.00";
    return `KES ${parseFloat(amount).toFixed(2)}`;
  };

  const renderBookingItem = ({ item }) => {
    const needsPayment =
      (item.status === "pending" && !item.booking_fee_paid) ||
      (item.status === "in_progress" &&
        item.valuation_amount &&
        !item.normal_payment_paid);

    const hasApprovedPayment = checkPaymentApproved(item);
    const confirmed = isBookingConfirmed(item.booking_id);

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => handleBookingPress(item)}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.bookingIdContainer}>
            <Ionicons name="pricetag-outline" size={16} color="#4caf50" />
            <Text style={styles.bookingId}>{item.booking_id}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status)}
              size={12}
              color="#fff"
            />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.serviceType}>{item.service_type}</Text>

        <View style={styles.detailsRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.value} numberOfLines={1}>
            {item.location}
          </Text>
        </View>

        <View style={styles.detailsRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.value}>
            Preferred: {formatDate(item.preferred_date)}
          </Text>
        </View>

        {item.assigned_engineer_name && (
          <View style={styles.detailsRow}>
            <Ionicons name="person-outline" size={16} color="#666" />
            <Text style={styles.value}>
              Engineer: {item.assigned_engineer_name}
            </Text>
          </View>
        )}

        {item.valuation_amount ? (
          <View style={styles.valuationContainer}>
            <Text style={styles.valuationLabel}>Valuation Amount:</Text>
            <Text style={styles.valuationAmount}>
              {formatCurrency(item.valuation_amount)}
            </Text>
          </View>
        ) : (
          <View style={styles.feeContainer}>
            <Text style={styles.feeLabel}>Booking Fee:</Text>
            <Text style={styles.feeAmount}>
              {formatCurrency(item.booking_fee)}
            </Text>
          </View>
        )}

        <View style={styles.statusDescription}>
          <Ionicons name="information-circle-outline" size={14} color="#666" />
          <Text style={styles.statusDescriptionText}>
            {getStatusDescription(item.status, !!item.valuation_amount)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {needsPayment && (
            <TouchableOpacity
              style={[styles.actionButton, styles.payButton]}
              onPress={() => handleMakePayment(item)}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>
                {item.valuation_amount ? "Pay Valuation" : "Pay Booking Fee"}
              </Text>
            </TouchableOpacity>
          )}

          {hasApprovedPayment && (
            <TouchableOpacity
              style={[styles.actionButton, styles.receiptButton]}
              onPress={() => handleViewReceipt(item)}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>View Receipt</Text>
            </TouchableOpacity>
          )}

          {/* Confirm Completion Button for completed bookings - disabled after click */}
          {item.status === "completed" && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.confirmButton,
                confirmed && styles.confirmedButton,
              ]}
              onPress={() => handleConfirmCompletion(item)}
              disabled={confirmed}
            >
              <Ionicons
                name={
                  confirmed
                    ? "checkmark-done-circle"
                    : "checkmark-done-circle-outline"
                }
                size={18}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>
                {confirmed ? "Confirmed" : "Confirm Completion"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailsModal = () => (
    <Modal
      visible={detailsModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setDetailsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailsModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Booking Details</Text>
            <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedBooking && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailsSection}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Booking ID:</Text>
                  <Text style={styles.detailValue}>
                    {selectedBooking.booking_id}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Service Type:</Text>
                  <Text style={styles.detailValue}>
                    {selectedBooking.service_type}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(selectedBooking.status),
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {selectedBooking.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location:</Text>
                  <Text style={styles.detailValue}>
                    {selectedBooking.location}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Preferred Date:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedBooking.preferred_date)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created:</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(selectedBooking.created_at)}
                  </Text>
                </View>

                {selectedBooking.description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.description}
                    </Text>
                  </View>
                )}

                {selectedBooking.assigned_engineer_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Assigned Engineer:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.assigned_engineer_name}
                    </Text>
                  </View>
                )}

                {selectedBooking.assigned_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Assigned Date:</Text>
                    <Text style={styles.detailValue}>
                      {formatDateTime(selectedBooking.assigned_at)}
                    </Text>
                  </View>
                )}

                {selectedBooking.assignment_notes && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Engineer Notes:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.assignment_notes}
                    </Text>
                  </View>
                )}

                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentDetailsTitle}>
                    Payment Information
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Booking Fee:</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedBooking.booking_fee)}
                    </Text>
                  </View>

                  {selectedBooking.valuation_amount && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Valuation Amount:</Text>
                      <Text style={[styles.detailValue, styles.valuationText]}>
                        {formatCurrency(selectedBooking.valuation_amount)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Booking Fee Paid:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.booking_fee_paid ? "Yes" : "No"}
                    </Text>
                  </View>

                  {selectedBooking.valuation_amount && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Status:</Text>
                      <Text style={styles.detailValue}>
                        {selectedBooking.normal_payment_paid
                          ? "Paid"
                          : "Pending"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActionButtons}>
                  {((selectedBooking.status === "pending" &&
                    !selectedBooking.booking_fee_paid) ||
                    (selectedBooking.status === "in_progress" &&
                      selectedBooking.valuation_amount &&
                      !selectedBooking.normal_payment_paid)) && (
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.modalPayButton]}
                      onPress={() => {
                        setDetailsModalVisible(false);
                        handleMakePayment(selectedBooking);
                      }}
                    >
                      <Ionicons name="card-outline" size={20} color="#fff" />
                      <Text style={styles.modalActionButtonText}>
                        {selectedBooking.valuation_amount
                          ? "Pay Valuation Now"
                          : "Pay Booking Fee Now"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {checkPaymentApproved(selectedBooking) && (
                    <TouchableOpacity
                      style={[
                        styles.modalActionButton,
                        styles.modalReceiptButton,
                      ]}
                      onPress={() => {
                        setDetailsModalVisible(false);
                        handleViewReceipt(selectedBooking);
                      }}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.modalActionButtonText}>
                        View Receipt
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Confirm Completion Button in modal - disabled after click */}
                  {selectedBooking.status === "completed" && (
                    <TouchableOpacity
                      style={[
                        styles.modalActionButton,
                        styles.modalConfirmButton,
                        isBookingConfirmed(selectedBooking.booking_id) &&
                          styles.modalConfirmedButton,
                      ]}
                      onPress={() => {
                        handleConfirmCompletion(selectedBooking);
                        setDetailsModalVisible(false);
                      }}
                      disabled={isBookingConfirmed(selectedBooking.booking_id)}
                    >
                      <Ionicons
                        name={
                          isBookingConfirmed(selectedBooking.booking_id)
                            ? "checkmark-done-circle"
                            : "checkmark-done-circle-outline"
                        }
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.modalActionButtonText}>
                        {isBookingConfirmed(selectedBooking.booking_id)
                          ? "Confirmed"
                          : "Confirm Completion"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderReceiptModal = () => (
    <Modal
      visible={receiptModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setReceiptModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.receiptModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment Receipt</Text>
            <TouchableOpacity onPress={() => setReceiptModalVisible(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedPayment && selectedPayment.booking && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.receiptContainer}>
                {/* Company Header */}
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptLogo}>🌿 Nairobi Botanica</Text>
                  <Text style={styles.receiptSubtitle}>Gardening Limited</Text>
                </View>

                <View style={styles.receiptTitle}>
                  <Text style={styles.receiptTitleText}>PAYMENT RECEIPT</Text>
                  <Text style={styles.receiptRef}>
                    Ref: RCT-{selectedPayment.payment_id}
                  </Text>
                </View>

                <View style={styles.receiptBody}>
                  {/* Company Info */}
                  <View style={styles.receiptCompanyInfo}>
                    <Text style={styles.receiptCompanyName}>
                      Nairobi Botanica Gardening Limited
                    </Text>
                    <Text style={styles.receiptCompanyAddress}>
                      Headquartered in Karen, Nairobi, Kenya
                    </Text>
                    <Text style={styles.receiptCompanyServices}>
                      Agriculture • Landscaping • Horticulture • Architecture •
                      Maintenance
                    </Text>
                  </View>

                  {/* Payment Details */}
                  <View style={styles.receiptDetails}>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Payment ID:</Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.payment_id}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Booking ID:</Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.booking.booking_id}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Service Type:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.booking.service_type}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Customer:</Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.booking.customer_name ||
                          userData?.name ||
                          "N/A"}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Email:</Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.booking.email ||
                          userData?.email ||
                          "N/A"}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Payment Type:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.payment_type === "booking_fee"
                          ? "Booking Fee"
                          : "Service Payment"}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Payment Method:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.payment_method || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Reference Code:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.reference_code || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Payment Date:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {formatDateTime(
                          selectedPayment.paid_at || selectedPayment.created_at,
                        )}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Service Location:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {selectedPayment.booking.location}
                      </Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>
                        Preferred Date:
                      </Text>
                      <Text style={styles.receiptDetailValue}>
                        {formatDate(selectedPayment.booking.preferred_date)}
                      </Text>
                    </View>

                    {selectedPayment.payment_type === "normal_payment" &&
                      selectedPayment.booking.valuation_amount && (
                        <>
                          <View style={styles.receiptDetailRow}>
                            <Text style={styles.receiptDetailLabel}>
                              Booking Fee:
                            </Text>
                            <Text style={styles.receiptDetailValue}>
                              {formatCurrency(
                                selectedPayment.booking.booking_fee,
                              )}
                            </Text>
                          </View>
                          <View style={styles.receiptDetailRow}>
                            <Text style={styles.receiptDetailLabel}>
                              Valuation Amount:
                            </Text>
                            <Text style={styles.receiptDetailValue}>
                              {formatCurrency(
                                selectedPayment.booking.valuation_amount,
                              )}
                            </Text>
                          </View>
                          {/* Add total calculation */}
                          <View
                            style={[
                              styles.receiptDetailRow,
                              styles.breakdownTotal,
                            ]}
                          >
                            <Text style={styles.receiptTotalLabel}>
                              Total Service Cost:
                            </Text>
                            <Text style={styles.receiptTotalValue}>
                              {formatCurrency(
                                parseFloat(
                                  selectedPayment.booking.booking_fee,
                                ) +
                                  parseFloat(
                                    selectedPayment.booking.valuation_amount,
                                  ),
                              )}
                            </Text>
                          </View>
                        </>
                      )}

                    <View
                      style={[styles.receiptDetailRow, styles.receiptTotalRow]}
                    >
                      <Text style={styles.receiptTotalLabel}>TOTAL PAID:</Text>
                      <Text style={styles.receiptTotalValue}>
                        {formatCurrency(selectedPayment.amount)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.receiptApproved}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#4caf50"
                    />
                    <Text style={styles.receiptApprovedText}>
                      PAYMENT APPROVED
                    </Text>
                  </View>

                  <View style={styles.receiptFooter}>
                    <Text style={styles.receiptFooterText}>
                      Thank you for choosing Nairobi Botanica!
                    </Text>
                    <Text style={styles.receiptFooterSmall}>
                      This is an electronically generated receipt. Valid without
                      signature.
                    </Text>
                  </View>
                </View>

                <View style={styles.receiptWatermark}>
                  <Text style={styles.receiptWatermarkText}>
                    Nairobi Botanica Gardening Limited • Professional •
                    Innovative • Customer-Centric
                  </Text>
                  <Text style={styles.receiptWatermarkDate}>
                    Generated on {new Date().toLocaleString()}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  generatingPDF && styles.disabledButton,
                ]}
                onPress={generateAndSharePDF}
                disabled={generatingPDF}
              >
                {generatingPDF ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.downloadButtonText}>
                      Download PDF Receipt
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Bookings</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Search Input */}
            <Text style={styles.filterLabel}>Search</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by ID, location..."
              value={filters.searchTerm}
              onChangeText={(text) =>
                setFilters({ ...filters, searchTerm: text })
              }
            />

            {/* Status Filter */}
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value })
                }
              >
                <Picker.Item label="All Statuses" value="" />
                {statusOptions.map((status) => (
                  <Picker.Item key={status} label={status} value={status} />
                ))}
              </Picker>
            </View>

            {/* Service Type Filter */}
            <Text style={styles.filterLabel}>Service Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.serviceType}
                onValueChange={(value) =>
                  setFilters({ ...filters, serviceType: value })
                }
              >
                <Picker.Item label="All Services" value="" />
                {serviceTypes.map((service) => (
                  <Picker.Item key={service} label={service} value={service} />
                ))}
              </Picker>
            </View>

            {/* Date Range */}
            <Text style={styles.filterLabel}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {filters.startDate
                  ? formatDate(filters.startDate)
                  : "Select Start Date"}
              </Text>
            </TouchableOpacity>

            {showStartDatePicker && (
              <DateTimePicker
                value={filters.startDate || new Date()}
                mode="date"
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(false);
                  if (selectedDate) {
                    setFilters({ ...filters, startDate: selectedDate });
                  }
                }}
              />
            )}

            <Text style={styles.filterLabel}>End Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {filters.endDate
                  ? formatDate(filters.endDate)
                  : "Select End Date"}
              </Text>
            </TouchableOpacity>

            {showEndDatePicker && (
              <DateTimePicker
                value={filters.endDate || new Date()}
                mode="date"
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(false);
                  if (selectedDate) {
                    setFilters({ ...filters, endDate: selectedDate });
                  }
                }}
              />
            )}
          </ScrollView>

          {/* Modal Buttons */}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.clearButton]}
              onPress={clearFilters}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.applyButton]}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.loadingText}>Loading your bookings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchBookings}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Service History</Text>
          <Text style={styles.subtitle}>
            Track your bookings and make payments
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredBookings.length}</Text>
        </View>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search bookings..."
            placeholderTextColor="#999"
            value={filters.searchTerm}
            onChangeText={(text) =>
              setFilters({ ...filters, searchTerm: text })
            }
          />
          {filters.searchTerm !== "" && (
            <TouchableOpacity
              onPress={() => setFilters({ ...filters, searchTerm: "" })}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            (filters.status ||
              filters.serviceType ||
              filters.startDate ||
              filters.endDate) &&
              styles.activeFilterButton,
          ]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons
            name="filter-outline"
            size={20}
            color={
              filters.status ||
              filters.serviceType ||
              filters.startDate ||
              filters.endDate
                ? "#fff"
                : "#4caf50"
            }
          />
          <Text
            style={[
              styles.filterButtonText,
              (filters.status ||
                filters.serviceType ||
                filters.startDate ||
                filters.endDate) &&
                styles.activeFilterButtonText,
            ]}
          >
            Filters
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Filters */}
      {(filters.status ||
        filters.serviceType ||
        filters.startDate ||
        filters.endDate) && (
        <View style={styles.activeFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.activeFiltersContainer}>
              {filters.status && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    Status: {filters.status}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilters({ ...filters, status: "" })}
                  >
                    <Ionicons name="close" size={16} color="#1976d2" />
                  </TouchableOpacity>
                </View>
              )}
              {filters.serviceType && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    Service: {filters.serviceType}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilters({ ...filters, serviceType: "" })}
                  >
                    <Ionicons name="close" size={16} color="#1976d2" />
                  </TouchableOpacity>
                </View>
              )}
              {filters.startDate && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    From: {formatDate(filters.startDate)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilters({ ...filters, startDate: null })}
                  >
                    <Ionicons name="close" size={16} color="#1976d2" />
                  </TouchableOpacity>
                </View>
              )}
              {filters.endDate && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    To: {formatDate(filters.endDate)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilters({ ...filters, endDate: null })}
                  >
                    <Ionicons name="close" size={16} color="#1976d2" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Bookings List */}
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.booking_id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4caf50"]}
            tintColor="#4caf50"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Bookings Found</Text>
            <Text style={styles.emptyText}>
              {filters.searchTerm ||
              filters.status ||
              filters.serviceType ||
              filters.startDate ||
              filters.endDate
                ? "Try adjusting your filters"
                : "You haven't made any bookings yet"}
            </Text>
            {(filters.searchTerm ||
              filters.status ||
              filters.serviceType ||
              filters.startDate ||
              filters.endDate) && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Modals */}
      {renderFiltersModal()}
      {renderDetailsModal()}
      {renderReceiptModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: "#4caf50",
    borderRadius: 20,
    minWidth: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: "#333",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4caf50",
    gap: 6,
  },
  activeFilterButton: {
    backgroundColor: "#4caf50",
    borderColor: "#4caf50",
  },
  filterButtonText: {
    color: "#4caf50",
    fontWeight: "600",
    fontSize: 14,
  },
  activeFilterButtonText: {
    color: "#fff",
  },
  activeFilters: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#e3f2fd",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  activeFiltersContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "#1976d2",
  },
  activeFilterChipText: {
    fontSize: 12,
    color: "#1976d2",
  },
  clearAllText: {
    fontSize: 12,
    color: "#f44336",
    fontWeight: "600",
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bookingIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4caf50",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  serviceType: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  value: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  feeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  feeLabel: {
    fontSize: 14,
    color: "#666",
  },
  feeAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4caf50",
  },
  valuationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff3e0",
    padding: 8,
    borderRadius: 8,
  },
  valuationLabel: {
    fontSize: 14,
    color: "#f57c00",
    fontWeight: "600",
  },
  valuationAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f57c00",
  },
  statusDescription: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  statusDescriptionText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  payButton: {
    backgroundColor: "#4caf50",
  },
  receiptButton: {
    backgroundColor: "#2196f3",
  },
  confirmButton: {
    backgroundColor: "#8bc34a", // Light green color for confirmation
  },
  confirmedButton: {
    backgroundColor: "#689f38", // Darker green when confirmed
    opacity: 0.8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  clearFiltersButton: {
    marginTop: 16,
    backgroundColor: "#4caf50",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#f44336",
    marginTop: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  detailsModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  receiptModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  breakdownTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#333",
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingBottom: 8,
    marginBottom: 8,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  detailsSection: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  detailLabel: {
    width: 120,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  paymentDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  paymentDetailsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  valuationText: {
    color: "#f57c00",
    fontWeight: "700",
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalPayButton: {
    backgroundColor: "#4caf50",
  },
  modalReceiptButton: {
    backgroundColor: "#2196f3",
  },
  modalConfirmButton: {
    backgroundColor: "#8bc34a",
  },
  modalConfirmedButton: {
    backgroundColor: "#689f38",
    opacity: 0.8,
  },
  modalActionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 8,
  },
  dateButtonText: {
    color: "#333",
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  clearButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  applyButton: {
    backgroundColor: "#4caf50",
    marginLeft: 8,
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Receipt Styles
  receiptContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  receiptHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  receiptLogo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1B5E20",
  },
  receiptSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  receiptTitle: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  receiptTitleText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  receiptRef: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  receiptBody: {
    gap: 16,
  },
  receiptCompanyInfo: {
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  receiptCompanyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1B5E20",
    marginBottom: 4,
  },
  receiptCompanyAddress: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 2,
  },
  receiptCompanyServices: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },
  receiptDetails: {
    gap: 8,
  },
  receiptDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  receiptDetailLabel: {
    fontSize: 13,
    color: "#666",
    width: "40%",
  },
  receiptDetailValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
    width: "60%",
    textAlign: "right",
  },
  receiptTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#333",
  },
  receiptTotalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4caf50",
  },
  receiptApproved: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    gap: 8,
  },
  receiptApprovedText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4caf50",
  },
  receiptFooter: {
    alignItems: "center",
    padding: 12,
  },
  receiptFooterText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  receiptFooterSmall: {
    fontSize: 11,
    color: "#888",
    fontStyle: "italic",
  },
  receiptWatermark: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
  },
  receiptWatermarkText: {
    fontSize: 10,
    color: "#999",
    textAlign: "center",
  },
  receiptWatermarkDate: {
    fontSize: 9,
    color: "#ccc",
    marginTop: 4,
  },
  downloadButton: {
    backgroundColor: "#2E7D32",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ServiceHistory;

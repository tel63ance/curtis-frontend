// payments.js
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

// Backend base URL
import { BASE_URL } from "../../config";

const Payments = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const phoneInputRef = useRef(null);
  const referenceInputRef = useRef(null);
  const isMounted = useRef(true);

  // Get params from navigation (if coming from booking)
  const {
    bookingId,
    amount: initialAmount,
    serviceType,
    paymentType: urlPaymentType,
    customerId,
    customerName,
    customerEmail,
  } = params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userData, setUserData] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [createdPaymentId, setCreatedPaymentId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Payment form state - MATCHING BACKEND REQUIREMENTS
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    reference_code: "",
    phoneNumber: "", // For M-Pesa only, not sent to backend
  });

  // Reference code validation rules by payment method
  const referenceCodeRules = useMemo(
    () => ({
      Mpesa: {
        pattern: /^[A-Z0-9]+$/,
        minLength: 8,
        maxLength: 12,
        message:
          "M-Pesa code must be 8-12 characters, all caps letters and numbers only",
        example: "",
      },
      "Airtel Money": {
        pattern: /^[A-Z0-9]+$/,
        minLength: 8,
        maxLength: 12,
        message:
          "Airtel Money code must be 8-12 characters, all caps letters and numbers only",
        example: "",
      },
      "Bank Transfer": {
        pattern: /^[A-Za-z0-9-]+$/,
        minLength: 5,
        maxLength: 30,
        message: "Bank reference can contain letters, numbers, and hyphens",
        example: "",
      },
    }),
    [],
  );

  // Bank transfer details - memoized to prevent unnecessary re-renders
  const bankDetails = useMemo(
    () => ({
      bankName: "Equity Bank Kenya",
      accountName: "Nairobi Botanica Gardening Ltd",
      accountNumber: "1234567890",
      branch: "Karen Branch",
      swiftCode: "EQBLKENA",
    }),
    [],
  );

  // Payment methods - memoized with correct enum values for backend
  const paymentMethods = useMemo(
    () => [
      {
        id: "Mpesa", // This matches the enum in your payment table
        label: "M-Pesa",
        icon: "mobile-alt",
        description: "Pay using M-Pesa",
        backendValue: "Mpesa",
      },
      {
        id: "Airtel Money", // This matches the enum in your payment table
        label: "Airtel Money",
        icon: "money-bill-wave",
        description: "Pay using Airtel Money",
        backendValue: "Airtel Money",
      },
      {
        id: "Bank Transfer", // This matches the enum in your payment table
        label: "Bank Transfer",
        icon: "university",
        description: "Direct bank transfer",
        backendValue: "Bank Transfer",
      },
    ],
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load user data once on mount
  useEffect(() => {
    const loadInitialData = async () => {
      await loadUserData();
    };
    loadInitialData();
  }, []);

  // Fetch bookings and payments when userData is available
  useEffect(() => {
    if (userData?.id) {
      const fetchData = async () => {
        await Promise.all([fetchPendingBookings(), fetchPaymentHistory()]);
        if (isMounted.current) {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [userData?.id]);

  // Update payment form when initialAmount or selectedBooking changes
  useEffect(() => {
    const amountToSet = selectedBooking?.booking_fee || initialAmount || "";
    const amountString = amountToSet.toString();

    if (paymentForm.amount !== amountString) {
      setPaymentForm((prev) => ({
        ...prev,
        amount: amountString,
      }));
    }
  }, [initialAmount, selectedBooking?.booking_fee]);

  // Auto-disable input when reference code reaches max length
  useEffect(() => {
    if (selectedPaymentMethod && referenceInputRef.current) {
      const rules = referenceCodeRules[selectedPaymentMethod];
      if (rules && paymentForm.reference_code.length >= rules.maxLength) {
        referenceInputRef.current.blur();
      }
    }
  }, [paymentForm.reference_code, selectedPaymentMethod, referenceCodeRules]);

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user && isMounted.current) {
        const parsedUser = JSON.parse(user);
        setUserData(parsedUser);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const fetchPendingBookings = useCallback(async () => {
    if (!userData?.id) return;

    try {
      const response = await fetch(
        `${BASE_URL}/api/bookings/customer/${userData.id}`,
      );
      const data = await response.json();

      if (response.ok && isMounted.current) {
        const pending = data.filter(
          (booking) =>
            booking.status === "pending" || booking.status === "approved",
        );
        setPendingBookings(pending);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  }, [userData?.id]);

  const fetchPaymentHistory = useCallback(async () => {
    if (!userData?.id) return;

    setLoadingPayments(true);
    try {
      const response = await fetch(
        `${BASE_URL}/api/payments/customer/${userData.id}`,
      );
      const data = await response.json();

      if (response.ok && isMounted.current) {
        setPaymentHistory(data);
      }
    } catch (error) {
      console.error("Error fetching payment history:", error);
    } finally {
      if (isMounted.current) {
        setLoadingPayments(false);
      }
    }
  }, [userData?.id]);

  const handlePaymentMethodSelect = useCallback(
    (method, booking = null) => {
      setSelectedPaymentMethod(method.id);
      setSelectedBooking(booking);
      setValidationErrors({});

      let amountToPay = "";
      if (booking?.booking_fee) {
        amountToPay = booking.booking_fee.toString();
      } else if (initialAmount) {
        amountToPay = initialAmount.toString();
      }

      setPaymentForm({
        amount: amountToPay,
        reference_code: "",
        phoneNumber: "",
      });

      setShowPaymentModal(true);
    },
    [initialAmount],
  );

  const validateReferenceCode = useCallback(
    (code, method) => {
      if (!method || !code) return false;

      const rules = referenceCodeRules[method];
      if (!rules) return true; // No validation rules for this method

      // Check length
      if (code.length < rules.minLength || code.length > rules.maxLength) {
        return false;
      }

      // Check pattern
      return rules.pattern.test(code);
    },
    [referenceCodeRules],
  );

  const validatePaymentForm = useCallback(() => {
    const errors = {};

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      errors.amount = "Please enter a valid amount";
    }

    if (
      selectedPaymentMethod === "Mpesa" ||
      selectedPaymentMethod === "Airtel Money"
    ) {
      if (!paymentForm.phoneNumber.trim()) {
        errors.phoneNumber = "Please enter your phone number";
      } else if (paymentForm.phoneNumber.length < 10) {
        errors.phoneNumber = "Please enter a valid 10-digit phone number";
      }

      if (!paymentForm.reference_code.trim()) {
        errors.reference_code = "Please enter the transaction code";
      } else if (
        !validateReferenceCode(
          paymentForm.reference_code,
          selectedPaymentMethod,
        )
      ) {
        errors.reference_code =
          referenceCodeRules[selectedPaymentMethod]?.message;
      }
    } else if (selectedPaymentMethod === "Bank Transfer") {
      if (!paymentForm.reference_code.trim()) {
        errors.reference_code = "Please enter the transaction reference";
      } else if (
        !validateReferenceCode(
          paymentForm.reference_code,
          selectedPaymentMethod,
        )
      ) {
        errors.reference_code =
          referenceCodeRules[selectedPaymentMethod]?.message;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [
    paymentForm.amount,
    paymentForm.phoneNumber,
    paymentForm.reference_code,
    selectedPaymentMethod,
    validateReferenceCode,
    referenceCodeRules,
  ]);

  const handleSubmitPayment = useCallback(async () => {
    if (!validatePaymentForm()) {
      // Show warning for incomplete form
      Alert.alert(
        "Incomplete Form",
        "Please fill in all required fields correctly before submitting.",
        [{ text: "OK" }],
      );
      return;
    }
    if (!userData?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    // Determine which booking ID to use
    const finalBookingId = selectedBooking?.booking_id || bookingId;
    if (!finalBookingId) {
      Alert.alert("Error", "Booking ID is required");
      return;
    }

    setSubmitting(true);
    try {
      // Determine payment_type based on context - MUST match enum in database
      const payment_type =
        urlPaymentType === "booking_fee" || selectedBooking?.booking_fee
          ? "booking_fee"
          : "normal_payment";

      // Find the selected method's backend value
      const selectedMethod = paymentMethods.find(
        (m) => m.id === selectedPaymentMethod,
      );

      // REQUIRED FIELDS for backend: customer_id, booking_id, payment_method, amount, reference_code, payment_type
      const paymentData = {
        customer_id: userData.id,
        booking_id: finalBookingId,
        payment_method: selectedMethod?.backendValue || selectedPaymentMethod,
        amount: parseFloat(paymentForm.amount),
        reference_code: paymentForm.reference_code.toUpperCase(), // Convert to uppercase for M-Pesa/Airtel
        payment_type: payment_type,
      };

      console.log("Submitting payment to backend:", paymentData);

      const response = await fetch(`${BASE_URL}/api/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();
      console.log("Payment response:", data);

      if (response.ok && isMounted.current) {
        setCreatedPaymentId(data.payment_id);
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        fetchPaymentHistory();
        setPaymentForm({
          amount: "",
          reference_code: "",
          phoneNumber: "",
        });
        setValidationErrors({});
      } else {
        Alert.alert("Error", data.error || "Failed to process payment");
      }
    } catch (error) {
      console.error("Network error:", error);
      Alert.alert(
        "Error",
        "Network error. Please check your connection and try again.",
      );
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  }, [
    validatePaymentForm,
    userData?.id,
    selectedPaymentMethod,
    paymentForm.amount,
    paymentForm.reference_code,
    fetchPaymentHistory,
    urlPaymentType,
    selectedBooking,
    bookingId,
    paymentMethods,
  ]);

  const copyToClipboard = useCallback((text) => {
    Alert.alert("Copied!", `${text} copied to clipboard`);
  }, []);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case "approved":
        return "#4CAF50";
      case "pending":
        return "#FFA500";
      case "rejected":
        return "#F44336";
      default:
        return "#757575";
    }
  }, []);

  const getStatusText = useCallback((status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, []);

  const formatCurrency = useCallback((amount) => {
    const numAmount = parseFloat(amount) || 0;
    return `KES ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Memoized form change handlers to prevent recreating on every render
  const handlePhoneChange = useCallback((text) => {
    setPaymentForm((prev) => ({ ...prev, phoneNumber: text }));
    setValidationErrors((prev) => ({ ...prev, phoneNumber: null }));
  }, []);

  const handleReferenceChange = useCallback(
    (text) => {
      // For M-Pesa and Airtel Money, automatically convert to uppercase
      const isMobileMoney =
        selectedPaymentMethod === "Mpesa" ||
        selectedPaymentMethod === "Airtel Money";

      const newText = isMobileMoney ? text.toUpperCase() : text;

      setPaymentForm((prev) => ({ ...prev, reference_code: newText }));
      setValidationErrors((prev) => ({ ...prev, reference_code: null }));
    },
    [selectedPaymentMethod],
  );

  const handleAmountChange = useCallback((text) => {
    setPaymentForm((prev) => ({ ...prev, amount: text }));
    setValidationErrors((prev) => ({ ...prev, amount: null }));
  }, []);

  const PaymentMethodCard = useCallback(
    ({ method, onPress }) => (
      <TouchableOpacity style={styles.methodCard} onPress={onPress}>
        <LinearGradient
          colors={["#ffffff", "#f8f9fa"]}
          style={styles.methodCardGradient}
        >
          <View style={styles.methodIconContainer}>
            <FontAwesome5 name={method.icon} size={24} color="#2E7D32" />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>{method.label}</Text>
            <Text style={styles.methodDescription}>{method.description}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#2E7D32" />
        </LinearGradient>
      </TouchableOpacity>
    ),
    [],
  );

  const PendingBookingItem = useCallback(
    ({ booking }) => (
      <TouchableOpacity
        style={styles.bookingItem}
        onPress={() => handlePaymentMethodSelect(paymentMethods[0], booking)}
      >
        <View style={styles.bookingItemHeader}>
          <Text style={styles.bookingItemService}>{booking.service_type}</Text>
          <Text style={styles.bookingItemId}>ID: {booking.booking_id}</Text>
        </View>
        <View style={styles.bookingItemDetails}>
          <Text style={styles.bookingItemAmount}>
            {booking.booking_fee
              ? formatCurrency(booking.booking_fee)
              : "Amount to be quoted"}
          </Text>
          <TouchableOpacity
            style={styles.payNowButton}
            onPress={() =>
              handlePaymentMethodSelect(paymentMethods[0], booking)
            }
          >
            <Text style={styles.payNowText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ),
    [handlePaymentMethodSelect, formatCurrency, paymentMethods],
  );

  const PaymentHistoryItem = useCallback(
    ({ item }) => (
      <View style={styles.historyItem}>
        <View style={styles.historyItemHeader}>
          <View>
            <Text style={styles.historyItemId}>
              Payment ID: {item.payment_id}
            </Text>
            <Text style={styles.historyItemRef}>
              Ref: {item.reference_code}
            </Text>
            {item.payment_type && (
              <Text style={styles.historyItemType}>
                Type:{" "}
                {item.payment_type === "booking_fee"
                  ? "Booking Fee"
                  : "Normal Payment"}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.historyStatus,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        <View style={styles.historyItemDetails}>
          <Text style={styles.historyItemAmount}>
            {formatCurrency(item.amount)}
          </Text>
          <Text style={styles.historyItemMethod}>{item.payment_method}</Text>
          <Text style={styles.historyItemDate}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    ),
    [getStatusColor, getStatusText, formatCurrency, formatDate],
  );

  // Memoize the modal content to prevent recreation
  const modalContent = useMemo(() => {
    if (!showPaymentModal) return null;

    const rules = selectedPaymentMethod
      ? referenceCodeRules[selectedPaymentMethod]
      : null;

    return (
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowPaymentModal(false);
          setValidationErrors({});
        }}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedPaymentMethod}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowPaymentModal(false);
                    setValidationErrors({});
                  }}
                >
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                ref={scrollViewRef}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContentContainer}
              >
                {(selectedBooking?.booking_id || bookingId) && (
                  <View style={styles.bookingInfoContainer}>
                    <Text style={styles.bookingInfoTitle}>Payment Details</Text>
                    <View style={styles.bookingInfoRow}>
                      <Text style={styles.bookingInfoLabel}>Booking ID:</Text>
                      <Text style={styles.bookingInfoValue}>
                        {selectedBooking?.booking_id || bookingId}
                      </Text>
                    </View>
                    {selectedBooking?.service_type && (
                      <View style={styles.bookingInfoRow}>
                        <Text style={styles.bookingInfoLabel}>Service:</Text>
                        <Text style={styles.bookingInfoValue}>
                          {selectedBooking.service_type}
                        </Text>
                      </View>
                    )}
                    <View style={styles.bookingInfoRow}>
                      <Text style={styles.bookingInfoLabel}>Payment Type:</Text>
                      <Text style={styles.bookingInfoValue}>
                        {urlPaymentType === "booking_fee" ||
                        selectedBooking?.booking_fee
                          ? "Booking Fee"
                          : "Normal Payment"}
                      </Text>
                    </View>
                  </View>
                )}

                {(selectedPaymentMethod === "Mpesa" ||
                  selectedPaymentMethod === "Airtel Money") && (
                  <View style={styles.modalBody}>
                    <View style={styles.paymentIconContainer}>
                      <FontAwesome5
                        name={
                          selectedPaymentMethod === "Mpesa"
                            ? "mobile-alt"
                            : "money-bill-wave"
                        }
                        size={40}
                        color="#2E7D32"
                      />
                      <Text style={styles.paymentMethodTitle}>
                        {selectedPaymentMethod}
                      </Text>
                    </View>

                    <Text style={styles.inputLabel}>Amount (KES)</Text>
                    <View style={[styles.inputContainer, styles.disabledInput]}>
                      <MaterialIcons
                        name="attach-money"
                        size={20}
                        color="#2E7D32"
                        style={styles.inputIcon}
                      />
                      <Text style={styles.disabledText}>
                        {paymentForm.amount
                          ? formatCurrency(paymentForm.amount)
                          : "Enter amount"}
                      </Text>
                    </View>
                    {validationErrors.amount && (
                      <Text style={styles.errorText}>
                        {validationErrors.amount}
                      </Text>
                    )}

                    <Text style={styles.inputLabel}>Phone Number *</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        validationErrors.phoneNumber && styles.inputError,
                      ]}
                    >
                      <MaterialIcons
                        name="phone"
                        size={20}
                        color="#2E7D32"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={phoneInputRef}
                        style={styles.input}
                        placeholder="Enter phone number used for payment"
                        placeholderTextColor="#999"
                        value={paymentForm.phoneNumber}
                        onChangeText={handlePhoneChange}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                    {validationErrors.phoneNumber && (
                      <Text style={styles.errorText}>
                        {validationErrors.phoneNumber}
                      </Text>
                    )}

                    <Text style={styles.inputLabel}>
                      Transaction Code *{" "}
                      {rules && `(${rules.minLength}-${rules.maxLength} chars)`}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        validationErrors.reference_code && styles.inputError,
                      ]}
                    >
                      <MaterialIcons
                        name="receipt"
                        size={20}
                        color="#2E7D32"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={referenceInputRef}
                        style={styles.input}
                        placeholder={
                          rules?.example ||
                          `Enter ${selectedPaymentMethod} transaction code`
                        }
                        placeholderTextColor="#999"
                        value={paymentForm.reference_code}
                        onChangeText={handleReferenceChange}
                        maxLength={rules?.maxLength}
                        autoCapitalize="characters"
                      />
                    </View>
                    {validationErrors.reference_code && (
                      <Text style={styles.errorText}>
                        {validationErrors.reference_code}
                      </Text>
                    )}
                    {rules && (
                      <Text style={styles.hintText}>{rules.message}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.initiatePaymentButton,
                        submitting && styles.disabledButton,
                      ]}
                      onPress={handleSubmitPayment}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.initiatePaymentText}>
                          Submit Payment
                        </Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.noteText}>
                      Please enter the transaction code you received after
                      completing the payment on your phone.
                    </Text>
                  </View>
                )}

                {selectedPaymentMethod === "Bank Transfer" && (
                  <View style={styles.modalBody}>
                    <View style={styles.paymentIconContainer}>
                      <FontAwesome5
                        name="university"
                        size={40}
                        color="#2E7D32"
                      />
                      <Text style={styles.paymentMethodTitle}>
                        Bank Transfer
                      </Text>
                    </View>

                    <View style={styles.bankDetailsCard}>
                      <Text style={styles.bankDetailsTitle}>
                        Bank Account Details
                      </Text>

                      {Object.entries(bankDetails).map(([key, value]) => (
                        <TouchableOpacity
                          key={key}
                          style={styles.bankDetailRow}
                          onPress={() => copyToClipboard(value)}
                        >
                          <Text style={styles.bankDetailLabel}>
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase())}
                            :
                          </Text>
                          <Text style={styles.bankDetailValue}>{value}</Text>
                          <MaterialIcons
                            name="content-copy"
                            size={16}
                            color="#2E7D32"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Amount (KES)</Text>
                    <View style={[styles.inputContainer, styles.disabledInput]}>
                      <MaterialIcons
                        name="attach-money"
                        size={20}
                        color="#2E7D32"
                        style={styles.inputIcon}
                      />
                      <Text style={styles.disabledText}>
                        {paymentForm.amount
                          ? formatCurrency(paymentForm.amount)
                          : "Enter amount"}
                      </Text>
                    </View>
                    {validationErrors.amount && (
                      <Text style={styles.errorText}>
                        {validationErrors.amount}
                      </Text>
                    )}

                    <Text style={styles.inputLabel}>
                      Transaction Reference *{" "}
                      {rules && `(${rules.minLength}-${rules.maxLength} chars)`}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        validationErrors.reference_code && styles.inputError,
                      ]}
                    >
                      <MaterialIcons
                        name="receipt"
                        size={20}
                        color="#2E7D32"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder={
                          rules?.example || "Enter transaction reference"
                        }
                        placeholderTextColor="#999"
                        value={paymentForm.reference_code}
                        onChangeText={handleReferenceChange}
                        maxLength={rules?.maxLength}
                      />
                    </View>
                    {validationErrors.reference_code && (
                      <Text style={styles.errorText}>
                        {validationErrors.reference_code}
                      </Text>
                    )}
                    {rules && (
                      <Text style={styles.hintText}>{rules.message}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.initiatePaymentButton,
                        submitting && styles.disabledButton,
                      ]}
                      onPress={handleSubmitPayment}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.initiatePaymentText}>
                          Submit Payment
                        </Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.noteText}>
                      After making the transfer, please submit the transaction
                      reference for verification. Payments will be confirmed
                      within 2-4 hours.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }, [
    showPaymentModal,
    selectedPaymentMethod,
    selectedBooking,
    bookingId,
    urlPaymentType,
    paymentForm.amount,
    paymentForm.phoneNumber,
    paymentForm.reference_code,
    submitting,
    validationErrors,
    handleSubmitPayment,
    handlePhoneChange,
    handleReferenceChange,
    handleAmountChange,
    copyToClipboard,
    bankDetails,
    formatCurrency,
    dismissKeyboard,
    referenceCodeRules,
  ]);

  const successModalContent = useMemo(() => {
    if (!showSuccessModal) return null;

    return (
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={["#ffffff", "#f1f8e9"]}
              style={styles.successModalContent}
            >
              <View style={styles.successIconContainer}>
                <FontAwesome5 name="check-circle" size={60} color="#4CAF50" />
              </View>
              <Text style={styles.successTitle}>Payment Submitted!</Text>
              <Text style={styles.successMessage}>
                Your payment has been submitted successfully.
              </Text>

              {createdPaymentId && (
                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentIdLabel}>Payment ID:</Text>
                  <Text style={styles.paymentIdValue}>{createdPaymentId}</Text>
                  {(selectedBooking?.booking_id || bookingId) && (
                    <Text style={styles.bookingRefText}>
                      For Booking: {selectedBooking?.booking_id || bookingId}
                    </Text>
                  )}
                  <Text style={styles.paymentTypeText}>
                    Type:{" "}
                    {urlPaymentType === "booking_fee" ||
                    selectedBooking?.booking_fee
                      ? "Booking Fee"
                      : "Normal Payment"}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push("/customer/history");
                }}
              >
                <Text style={styles.successButtonText}>View My Bookings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.laterButton}
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.laterButtonText}>Close</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }, [
    showSuccessModal,
    createdPaymentId,
    selectedBooking,
    bookingId,
    urlPaymentType,
    dismissKeyboard,
    router,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <LinearGradient
          colors={["#1B5E20", "#2E7D32", "#388E3C"]}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payments</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.userInfoContainer}>
            <FontAwesome5 name="user-circle" size={40} color="#ffffff" />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {userData?.name || customerName || "Customer"}
              </Text>
              <Text style={styles.userEmail}>
                {userData?.email || customerEmail || ""}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Active Payment Banner */}
        {bookingId && initialAmount && (
          <LinearGradient
            colors={["#FFA500", "#FF8C00"]}
            style={styles.activePaymentBanner}
          >
            <View style={styles.bannerContent}>
              <MaterialIcons name="payment" size={24} color="#ffffff" />
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Pending Payment</Text>
                <Text style={styles.bannerSubtitle}>
                  Booking {bookingId} • {formatCurrency(initialAmount)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.bannerButton}
                onPress={() => {
                  setSelectedBooking({
                    booking_id: bookingId,
                    service_type: serviceType,
                    booking_fee: initialAmount,
                  });
                  handlePaymentMethodSelect(paymentMethods[0]);
                }}
              >
                <Text style={styles.bannerButtonText}>Pay Now</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        {/* Payment Methods */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          {paymentMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onPress={() => handlePaymentMethodSelect(method)}
            />
          ))}
        </View>

        {/* Pending Bookings */}
        {pendingBookings.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Pending Payments</Text>
            {pendingBookings.map((booking) => (
              <PendingBookingItem key={booking.booking_id} booking={booking} />
            ))}
          </View>
        )}

        {/* Payment History */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {loadingPayments ? (
            <ActivityIndicator
              size="small"
              color="#2E7D32"
              style={styles.loader}
            />
          ) : paymentHistory.length > 0 ? (
            <FlatList
              data={paymentHistory}
              renderItem={({ item }) => <PaymentHistoryItem item={item} />}
              keyExtractor={(item) => item.payment_id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="history" size={40} color="#ccc" />
              <Text style={styles.emptyStateText}>No payment history</Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <LinearGradient colors={["#e8f5e9", "#c8e6c9"]} style={styles.infoCard}>
          <MaterialIcons name="info" size={24} color="#2E7D32" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Payment Information</Text>
            <Text style={styles.infoText}>
              • M-Pesa payments are processed instantly{"\n"}• Airtel Money
              payments are processed within minutes{"\n"}• Bank transfers may
              take 2-4 hours to verify{"\n"}• Payment status: Pending →
              Approved/Rejected
            </Text>
          </View>
        </LinearGradient>
      </ScrollView>

      {/* Modals */}
      {modalContent}
      {successModalContent}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 10,
    color: "#2E7D32",
    fontSize: 16,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  userInfo: {
    marginLeft: 15,
  },
  userName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  userEmail: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  sectionContainer: {
    backgroundColor: "#ffffff",
    margin: 20,
    marginTop: 10,
    marginBottom: 10,
    padding: 20,
    borderRadius: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  methodCard: {
    marginBottom: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  methodCardGradient: {
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  methodIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 12,
    color: "#666",
  },
  bookingItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  bookingItemHeader: {
    marginBottom: 10,
  },
  bookingItemService: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  bookingItemId: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  bookingItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookingItemAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    flex: 1,
  },
  payNowButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  payNowText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  historyItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  historyItemId: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  historyItemRef: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  historyItemType: {
    fontSize: 11,
    color: "#2E7D32",
    marginTop: 2,
    fontStyle: "italic",
  },
  historyStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
  },
  historyItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyItemAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  historyItemMethod: {
    fontSize: 12,
    color: "#666",
  },
  historyItemDate: {
    fontSize: 11,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    marginTop: 10,
  },
  loader: {
    marginVertical: 20,
  },
  infoCard: {
    flexDirection: "row",
    margin: 20,
    marginTop: 0,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    marginLeft: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 5,
  },
  infoText: {
    fontSize: 12,
    color: "#555",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalBody: {
    paddingBottom: 20,
  },
  paymentIconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  paymentMethodTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2E7D32",
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 5,
    marginTop: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  inputError: {
    borderColor: "#F44336",
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    padding: 0,
  },
  disabledInput: {
    backgroundColor: "#f0f0f0",
  },
  disabledText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
  },
  errorText: {
    color: "#F44336",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 5,
  },
  hintText: {
    color: "#666",
    fontSize: 11,
    marginTop: 4,
    marginLeft: 5,
    fontStyle: "italic",
  },
  initiatePaymentButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: "#cccccc",
  },
  initiatePaymentText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  noteText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 15,
    textAlign: "center",
  },
  bankDetailsCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  bankDetailsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 10,
  },
  bankDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  bankDetailLabel: {
    fontSize: 12,
    color: "#666",
    width: 100,
  },
  bankDetailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
    marginRight: 10,
  },
  successModalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 30,
    width: "85%",
    alignItems: "center",
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  paymentDetails: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  paymentIdLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  paymentIdValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 5,
  },
  paymentTypeText: {
    fontSize: 12,
    color: "#2E7D32",
    marginTop: 5,
    fontStyle: "italic",
  },
  bookingRefText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  successButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  successButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  laterButton: {
    paddingHorizontal: 40,
    paddingVertical: 8,
  },
  laterButtonText: {
    color: "#666",
    fontSize: 14,
  },
  activePaymentBanner: {
    margin: 20,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  bannerSubtitle: {
    color: "#ffffff",
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  bannerButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerButtonText: {
    color: "#FF8C00",
    fontSize: 12,
    fontWeight: "600",
  },
  bookingInfoContainer: {
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  bookingInfoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 10,
  },
  bookingInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  bookingInfoLabel: {
    fontSize: 12,
    color: "#666",
  },
  bookingInfoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
});

export default Payments;

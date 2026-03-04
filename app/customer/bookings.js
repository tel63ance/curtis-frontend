// bookings.js
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Backend base URL
import { BASE_URL } from "../../config";
// Booking fee constant
const BOOKING_FEE = 750;

const Bookings = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    service_type: "",
    description: "",
    location: "",
    preferred_date: new Date(),
  });

  // Exact service types from your database enum
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

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (userData) {
      setLoading(false);
    }
  }, [userData]);

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const parsedUser = JSON.parse(user);
        setUserData(parsedUser);
      } else {
        console.log("No user found in AsyncStorage");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, preferred_date: selectedDate });
    }
  };

  const formatDate = (date) => {
    return date.toISOString().split("T")[0];
  };

  const validateForm = () => {
    if (!formData.service_type) {
      Alert.alert("Error", "Please select a service type");
      return false;
    }
    if (!formData.location.trim()) {
      Alert.alert("Error", "Please enter your location");
      return false;
    }
    if (!formData.preferred_date) {
      Alert.alert("Error", "Please select a preferred date");
      return false;
    }
    if (!feeAcknowledged) {
      Alert.alert("Error", "Please acknowledge the booking fee");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!userData?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setSubmitting(true);
    try {
      const bookingData = {
        customer_id: userData.id,
        service_type: formData.service_type,
        description: formData.description.trim() || null,
        location: formData.location.trim(),
        preferred_date: formatDate(formData.preferred_date),
        booking_fee: BOOKING_FEE,
      };

      console.log("Submitting booking with fee:", bookingData);

      const response = await fetch(`${BASE_URL}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      const data = await response.json();

      if (response.ok) {
        setCreatedBooking({
          booking_id: data.booking_id,
          ...bookingData,
        });

        setShowSuccessModal(true);

        // Reset form
        setFormData({
          service_type: "",
          description: "",
          location: "",
          preferred_date: new Date(),
        });
        setFeeAcknowledged(false);
      } else {
        Alert.alert("Error", data.error || "Failed to create booking");
      }
    } catch (error) {
      console.error("Network error:", error);
      Alert.alert(
        "Error",
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToPayBookingFee = (booking) => {
    router.push({
      pathname: "/customer/payments",
      params: {
        bookingId: booking.booking_id,
        amount: BOOKING_FEE.toString(),
        serviceType: booking.service_type,
        paymentType: "booking_fee",
        customerId: userData?.id,
        customerName: userData?.name,
        customerEmail: userData?.email,
      },
    });
    setShowSuccessModal(false);
  };

  const formatCurrency = (amount) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const renderServiceDropdown = () => (
    <Modal
      visible={showServiceDropdown}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowServiceDropdown(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowServiceDropdown(false)}
      >
        <View style={styles.dropdownContent}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>Select Service Type</Text>
            <TouchableOpacity onPress={() => setShowServiceDropdown(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={serviceTypes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setFormData({ ...formData, service_type: item });
                  setShowServiceDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    formData.service_type === item &&
                      styles.dropdownItemTextSelected,
                  ]}
                >
                  {item}
                </Text>
                {formData.service_type === item && (
                  <MaterialIcons name="check" size={20} color="#2E7D32" />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const SuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={["#ffffff", "#f1f8e9"]}
          style={styles.successModalContent}
        >
          <View style={styles.successIconContainer}>
            <FontAwesome5 name="check-circle" size={60} color="#4CAF50" />
          </View>
          <Text style={styles.successTitle}>Booking Confirmed!</Text>
          <Text style={styles.successMessage}>
            Your booking has been created successfully.
          </Text>

          {createdBooking && (
            <View style={styles.bookingDetails}>
              <Text style={styles.bookingIdLabel}>Booking ID:</Text>
              <Text style={styles.bookingIdValue}>
                {createdBooking.booking_id}
              </Text>
              <Text style={styles.bookingService}>
                {createdBooking.service_type}
              </Text>
              <View style={styles.feeDisplay}>
                <Text style={styles.feeLabel}>Booking Fee:</Text>
                <Text style={styles.feeValue}>
                  {formatCurrency(BOOKING_FEE)}
                </Text>
              </View>
              <Text style={styles.bookingDate}>
                Preferred Date:{" "}
                {new Date(createdBooking.preferred_date).toLocaleDateString(
                  "en-KE",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.successButton}
            onPress={() => navigateToPayBookingFee(createdBooking)}
          >
            <Text style={styles.successButtonText}>Pay Booking Fee Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={styles.laterButtonText}>Pay Later</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );

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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Simple Header with only title */}
          <LinearGradient
            colors={["#1B5E20", "#2E7D32", "#388E3C"]}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Book a Service</Text>
            </View>
          </LinearGradient>

          {/* Booking Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Service Details</Text>

            {/* Service Type Dropdown */}
            <Text style={styles.inputLabel}>Service Type *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowServiceDropdown(true)}
            >
              <Text
                style={[
                  styles.dropdownButtonText,
                  !formData.service_type && styles.placeholderText,
                ]}
              >
                {formData.service_type || "Select a service type"}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
            </TouchableOpacity>

            {/* Location Input */}
            <Text style={styles.inputLabel}>Location *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="location-on"
                size={20}
                color="#2E7D32"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your location (e.g., Karen, Nairobi)"
                placeholderTextColor="#999"
                value={formData.location}
                onChangeText={(text) =>
                  setFormData({ ...formData, location: text })
                }
              />
            </View>

            {/* Preferred Date Picker */}
            <Text style={styles.inputLabel}>Preferred Date *</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcons name="date-range" size={20} color="#2E7D32" />
              <Text style={styles.datePickerText}>
                {formData.preferred_date.toLocaleDateString("en-KE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={formData.preferred_date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {/* Description Input (Optional) */}
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us more about your requirements..."
                placeholderTextColor="#999"
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Booking Fee Section */}
            <View style={styles.feeContainer}>
              <LinearGradient
                colors={["#e8f5e9", "#c8e6c9"]}
                style={styles.feeCard}
              >
                <View style={styles.feeHeader}>
                  <MaterialIcons name="info" size={20} color="#2E7D32" />
                  <Text style={styles.feeTitle}>Booking Commitment Fee</Text>
                </View>
                <Text style={styles.feeAmount}>
                  {formatCurrency(BOOKING_FEE)}
                </Text>
                <Text style={styles.feeDescription}>
                  This non-refundable fee shows your commitment and seriousness
                  to proceed with the project. It will be deducted from your
                  final invoice.
                </Text>

                {/* Acknowledge Checkbox */}
                <TouchableOpacity
                  style={styles.acknowledgeContainer}
                  onPress={() => setFeeAcknowledged(!feeAcknowledged)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      feeAcknowledged && styles.checkboxChecked,
                    ]}
                  >
                    {feeAcknowledged && (
                      <MaterialIcons name="check" size={16} color="#ffffff" />
                    )}
                  </View>
                  <Text style={styles.acknowledgeText}>
                    I understand and agree to pay the booking fee of{" "}
                    {formatCurrency(BOOKING_FEE)}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (submitting || !feeAcknowledged) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !feeAcknowledged}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <FontAwesome5
                    name="calendar-check"
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.submitButtonText}>
                    Confirm Booking • {formatCurrency(BOOKING_FEE)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Card */}
          <LinearGradient
            colors={["#e8f5e9", "#c8e6c9"]}
            style={styles.infoCard}
          >
            <MaterialIcons name="info" size={24} color="#2E7D32" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>About the Booking Fee</Text>
              <Text style={styles.infoText}>
                • One-time fee of {formatCurrency(BOOKING_FEE)}
                {"\n"}• Confirms your commitment to the project{"\n"}• Deducted
                from your final invoice{"\n"}• Ensures serious inquiries only
              </Text>
            </View>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      {renderServiceDropdown()}
      <SuccessModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  headerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  formContainer: {
    backgroundColor: "#ffffff",
    margin: 20,
    marginTop: -10,
    padding: 20,
    borderRadius: 15,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 5,
    marginTop: 10,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  dropdownButtonText: {
    fontSize: 14,
    color: "#333",
  },
  placeholderText: {
    color: "#999",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
  },
  textAreaContainer: {
    alignItems: "flex-start",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  datePickerText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  feeContainer: {
    marginTop: 20,
  },
  feeCard: {
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#2E7D32",
  },
  feeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  feeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32",
    marginLeft: 5,
  },
  feeAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2E7D32",
    textAlign: "center",
    marginBottom: 10,
  },
  feeDescription: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 15,
  },
  acknowledgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#2E7D32",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#2E7D32",
  },
  acknowledgeText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  submitButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 10,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
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
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownContent: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    width: "90%",
    maxHeight: "70%",
    padding: 20,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownItemTextSelected: {
    color: "#2E7D32",
    fontWeight: "600",
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
  bookingDetails: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  bookingIdLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  bookingIdValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 5,
  },
  bookingService: {
    fontSize: 14,
    color: "#333",
    marginBottom: 3,
  },
  feeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  feeLabel: {
    fontSize: 12,
    color: "#666",
    marginRight: 5,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  bookingDate: {
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
});

export default Bookings;

// app/engineer/dashboard.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { BASE_URL } from "../../config";

const EngineerDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [engineer, setEngineer] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    in_progress: 0,
    pending_valuation: 0,
    waiting_payment: 0,
    ready_to_complete: 0,
    completed: 0,
  });

  // Inventory Requests State
  const [inventoryRequestsVisible, setInventoryRequestsVisible] =
    useState(false);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsRefreshing, setRequestsRefreshing] = useState(false);
  const [selectedRequestStatus, setSelectedRequestStatus] = useState("all");
  const [requestSearchQuery, setRequestSearchQuery] = useState("");

  // New Request Modal
  const [newRequestModalVisible, setNewRequestModalVisible] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [requestQuantity, setRequestQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Request Details Modal
  const [requestDetailsModalVisible, setRequestDetailsModalVisible] =
    useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Request Stats
  const [requestStats, setRequestStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  // Valuation Modal
  const [valuationModalVisible, setValuationModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [valuationAmount, setValuationAmount] = useState("");
  const [valuationNotes, setValuationNotes] = useState("");
  const [submittingValuation, setSubmittingValuation] = useState(false);

  // Booking Details Modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    loadEngineerData();
  }, []);

  useEffect(() => {
    if (engineer) {
      fetchEngineerBookings();
    }
  }, [engineer]);

  useEffect(() => {
    filterBookings();
  }, [bookings, selectedStatus, searchQuery]);

  useEffect(() => {
    if (engineer && inventoryRequestsVisible) {
      fetchInventoryRequests();
    }
  }, [engineer, inventoryRequestsVisible]);

  useEffect(() => {
    filterRequests();
  }, [requests, selectedRequestStatus, requestSearchQuery]);

  const loadEngineerData = async () => {
    try {
      const userStr = await AsyncStorage.getItem("user");

      if (!userStr) {
        Alert.alert("Error", "Please login again");
        return;
      }

      const user = JSON.parse(userStr);

      if (user.role !== "engineer" && user.role !== "admin") {
        Alert.alert(
          "Access Denied",
          "You don't have permission to access this page",
        );
        return;
      }

      setEngineer(user);
    } catch (error) {
      console.error("Error loading engineer data:", error);
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

  const fetchEngineerBookings = async () => {
    if (!engineer?.id) return;

    try {
      setLoading(true);
      const token = await getAuthToken();

      const response = await fetch(
        `${BASE_URL}/api/bookings/engineer/${engineer.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const bookingsArray = Array.isArray(data) ? data : [];
      setBookings(bookingsArray);

      const inProgress = bookingsArray.filter(
        (b) => b.status === "in_progress" && !b.valuation_amount,
      ).length;

      const waitingPayment = bookingsArray.filter(
        (b) =>
          b.status === "in_progress" &&
          b.valuation_amount &&
          !b.normal_payment_approved,
      ).length;

      const readyToComplete = bookingsArray.filter(
        (b) =>
          b.status === "in_progress" &&
          b.valuation_amount &&
          b.normal_payment_approved,
      ).length;

      const completed = bookingsArray.filter(
        (b) => b.status === "completed",
      ).length;

      setStats({
        total: bookingsArray.length,
        in_progress: inProgress,
        pending_valuation: inProgress,
        waiting_payment: waitingPayment,
        ready_to_complete: readyToComplete,
        completed: completed,
      });
    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Error", "Failed to fetch assigned bookings");
      setBookings([]);
      setStats({
        total: 0,
        in_progress: 0,
        pending_valuation: 0,
        waiting_payment: 0,
        ready_to_complete: 0,
        completed: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ==================== INVENTORY REQUESTS FUNCTIONS ====================

  const fetchInventoryRequests = async () => {
    if (!engineer?.id) return;

    try {
      setRequestsLoading(true);
      const token = await getAuthToken();

      // Use the engineer-specific endpoint
      const response = await fetch(
        `${BASE_URL}/api/inventory/requests/engineer/${engineer.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const requestsArray = Array.isArray(data) ? data : [];

      setRequests(requestsArray);

      const pending = requestsArray.filter(
        (r) => r.status === "pending",
      ).length;
      const approved = requestsArray.filter(
        (r) => r.status === "approved",
      ).length;
      const rejected = requestsArray.filter(
        (r) => r.status === "rejected",
      ).length;

      setRequestStats({
        pending,
        approved,
        rejected,
        total: requestsArray.length,
      });
    } catch (error) {
      console.error("Fetch requests error:", error);
      Alert.alert("Error", "Failed to fetch inventory requests");
      setRequests([]);
      setRequestStats({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      });
    } finally {
      setRequestsLoading(false);
      setRequestsRefreshing(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      setLoadingInventory(true);
      const token = await getAuthToken();

      const response = await fetch(`${BASE_URL}/api/inventory`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const itemsArray = Array.isArray(data) ? data : [];
      setInventoryItems(itemsArray);
    } catch (error) {
      console.error("Fetch inventory error:", error);
      Alert.alert("Error", "Failed to fetch inventory items");
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleNewRequestPress = () => {
    setSelectedInventory(null);
    setRequestQuantity("");
    fetchInventoryItems();
    setNewRequestModalVisible(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedInventory) {
      Alert.alert("Error", "Please select an item");
      return;
    }

    if (!requestQuantity || parseInt(requestQuantity) <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();

      const response = await fetch(`${BASE_URL}/api/inventory/request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          engineer_id: engineer.id,
          inventory_id: selectedInventory.id,
          quantity: parseInt(requestQuantity),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Request submitted successfully", [
          {
            text: "OK",
            onPress: () => {
              setNewRequestModalVisible(false);
              fetchInventoryRequests();
            },
          },
        ]);
      } else {
        throw new Error(result.error || "Failed to submit request");
      }
    } catch (error) {
      console.error("Request error:", error);
      Alert.alert("Error", error.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestPress = (request) => {
    setSelectedRequest(request);
    setRequestDetailsModalVisible(true);
  };

  const onRequestsRefresh = useCallback(() => {
    setRequestsRefreshing(true);
    fetchInventoryRequests();
  }, [engineer]);

  const filterRequests = useCallback(() => {
    const requestsArray = Array.isArray(requests) ? requests : [];
    let filtered = [...requestsArray];

    if (selectedRequestStatus !== "all") {
      filtered = filtered.filter(
        (request) => request.status === selectedRequestStatus,
      );
    }

    if (requestSearchQuery) {
      const query = requestSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          (request.item_name?.toLowerCase() || "").includes(query) ||
          (request.id?.toLowerCase() || "").includes(query),
      );
    }

    setFilteredRequests(filtered);
  }, [requests, selectedRequestStatus, requestSearchQuery]);

  const getRequestStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "approved":
        return "#10b981";
      case "rejected":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getRequestStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "approved":
        return "checkmark-circle-outline";
      case "rejected":
        return "close-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const formatDateTime = useCallback((dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // ==================== RENDER FUNCTIONS ====================

  const renderInventoryRequestsScreen = () => (
    <Modal
      visible={inventoryRequestsVisible}
      animationType="slide"
      onRequestClose={() => setInventoryRequestsVisible(false)}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setInventoryRequestsVisible(false)}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Inventory Requests</Text>
          <TouchableOpacity onPress={handleNewRequestPress}>
            <Ionicons name="add-circle" size={28} color="#2d6a4f" />
          </TouchableOpacity>
        </View>

        {/* Request Stats */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
        >
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Ionicons name="time-outline" size={24} color="#f59e0b" />
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{requestStats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#10b981" }]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color="#10b981"
              />
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{requestStats.approved}</Text>
                <Text style={styles.statLabel}>Approved</Text>
              </View>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#ef4444" }]}>
              <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{requestStats.rejected}</Text>
                <Text style={styles.statLabel}>Rejected</Text>
              </View>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#64748b" }]}>
              <Ionicons name="cube-outline" size={24} color="#64748b" />
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{requestStats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Filter Section */}
        <View style={styles.filterContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search requests..."
              value={requestSearchQuery}
              onChangeText={setRequestSearchQuery}
              placeholderTextColor="#94a3b8"
            />
            {requestSearchQuery !== "" && (
              <TouchableOpacity onPress={() => setRequestSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChips}>
                {["all", "pending", "approved", "rejected"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      selectedRequestStatus === status &&
                        styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedRequestStatus(status)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedRequestStatus === status &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Requests List */}
        {requestsLoading && !requestsRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2d6a4f" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            renderItem={renderRequestCard}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={requestsRefreshing}
                onRefresh={onRequestsRefresh}
                colors={["#2d6a4f"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No requests found</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the + button to create your first inventory request
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* New Request Modal */}
      {renderNewRequestModal()}

      {/* Request Details Modal */}
      {renderRequestDetailsModal()}
    </Modal>
  );

  const renderRequestCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleRequestPress(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.bookingIdContainer}>
          <Ionicons name="cube-outline" size={16} color="#2d6a4f" />
          <Text style={styles.bookingId}>{item.id}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getRequestStatusColor(item.status) },
          ]}
        >
          <Ionicons
            name={getRequestStatusIcon(item.status)}
            size={12}
            color="#fff"
          />
          <Text style={styles.statusText}>
            {item.status?.toUpperCase() || "UNKNOWN"}
          </Text>
        </View>
      </View>

      <Text style={styles.serviceType}>{item.item_name || "Unknown Item"}</Text>

      <View style={styles.cardBody}>
        <View style={styles.infoGrid}>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>
                Requested: {item.requested_quantity || 0}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>
                {formatDateTime(item.created_at)}
              </Text>
            </View>
          </View>
          <View style={styles.infoColumn}>
            {item.approved_at && (
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                <Text style={styles.infoText}>
                  Approved: {formatDateTime(item.approved_at)}
                </Text>
              </View>
            )}
            {item.rejection_reason && (
              <View style={styles.infoRow}>
                <Ionicons name="alert-circle" size={14} color="#ef4444" />
                <Text
                  style={[styles.infoText, { color: "#ef4444" }]}
                  numberOfLines={1}
                >
                  {item.rejection_reason}
                </Text>
              </View>
            )}
          </View>
        </View>

        {item.status === "approved" && (
          <View
            style={[
              styles.statusMessage,
              { backgroundColor: "#10b98120", marginTop: 8 },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={[styles.statusMessageText, { color: "#10b981" }]}>
              Request Approved
            </Text>
          </View>
        )}

        {item.status === "rejected" && item.rejection_reason && (
          <View style={[styles.notesContainer, { marginTop: 8 }]}>
            <Ionicons name="alert-circle" size={14} color="#ef4444" />
            <Text style={[styles.notesText, { color: "#ef4444" }]}>
              {item.rejection_reason}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderNewRequestModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={newRequestModalVisible}
      onRequestClose={() => setNewRequestModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Inventory Request</Text>
            <TouchableOpacity onPress={() => setNewRequestModalVisible(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalBody}>
              {loadingInventory ? (
                <ActivityIndicator size="large" color="#2d6a4f" />
              ) : (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Select Item *</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View style={styles.inventoryItemsContainer}>
                        {inventoryItems.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.inventoryItemCard,
                              selectedInventory?.id === item.id &&
                                styles.selectedInventoryItem,
                            ]}
                            onPress={() => setSelectedInventory(item)}
                          >
                            <Ionicons
                              name="cube-outline"
                              size={24}
                              color={
                                selectedInventory?.id === item.id
                                  ? "#fff"
                                  : "#2d6a4f"
                              }
                            />
                            <Text
                              style={[
                                styles.inventoryItemName,
                                selectedInventory?.id === item.id &&
                                  styles.selectedInventoryItemText,
                              ]}
                              numberOfLines={2}
                            >
                              {item.item_name}
                            </Text>
                            <Text
                              style={[
                                styles.inventoryItemStock,
                                selectedInventory?.id === item.id &&
                                  styles.selectedInventoryItemText,
                              ]}
                            >
                              Stock: {item.quantity} {item.unit}
                            </Text>
                            <Text
                              style={[
                                styles.inventoryItemStatus,
                                {
                                  color:
                                    item.status === "Available"
                                      ? "#10b981"
                                      : "#f59e0b",
                                },
                              ]}
                            >
                              {item.status}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {selectedInventory && (
                    <>
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Available Stock</Text>
                        <View style={styles.stockInfo}>
                          <Text style={styles.stockValue}>
                            {selectedInventory.quantity}{" "}
                            {selectedInventory.unit}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Quantity Required *</Text>
                        <TextInput
                          style={styles.amountInput}
                          placeholder="Enter quantity"
                          value={requestQuantity}
                          onChangeText={setRequestQuantity}
                          keyboardType="numeric"
                        />
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          submitting && styles.disabledButton,
                        ]}
                        onPress={handleSubmitRequest}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Ionicons
                              name="send-outline"
                              size={20}
                              color="#fff"
                            />
                            <Text style={styles.submitButtonText}>
                              Submit Request
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderRequestDetailsModal = () => (
    <Modal
      visible={requestDetailsModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setRequestDetailsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <TouchableOpacity
              onPress={() => setRequestDetailsModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {selectedRequest && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <View style={styles.bookingSummary}>
                  <View style={styles.detailRow}>
                    <Text style={styles.summaryLabel}>Request ID:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.id}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.summaryLabel}>Item:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.item_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.summaryLabel}>Quantity:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedRequest.requested_quantity}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.summaryLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getRequestStatusColor(
                            selectedRequest.status,
                          ),
                          alignSelf: "flex-start",
                        },
                      ]}
                    >
                      <Ionicons
                        name={getRequestStatusIcon(selectedRequest.status)}
                        size={12}
                        color="#fff"
                      />
                      <Text style={styles.statusText}>
                        {selectedRequest.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.summaryLabel}>Requested Date:</Text>
                    <Text style={styles.summaryValue}>
                      {formatDateTime(selectedRequest.created_at)}
                    </Text>
                  </View>

                  {selectedRequest.approved_at && (
                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Approved Date:</Text>
                      <Text style={styles.summaryValue}>
                        {formatDateTime(selectedRequest.approved_at)}
                      </Text>
                    </View>
                  )}

                  {selectedRequest.rejection_reason && (
                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Rejection Reason:</Text>
                      <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
                        {selectedRequest.rejection_reason}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEngineerBookings();
  }, []);

  const filterBookings = useCallback(() => {
    const bookingsArray = Array.isArray(bookings) ? bookings : [];
    let filtered = [...bookingsArray];

    if (selectedStatus !== "all") {
      if (selectedStatus === "pending_valuation") {
        filtered = filtered.filter(
          (booking) =>
            booking.status === "in_progress" && !booking.valuation_amount,
        );
      } else if (selectedStatus === "waiting_payment") {
        filtered = filtered.filter(
          (booking) =>
            booking.status === "in_progress" &&
            booking.valuation_amount &&
            !booking.normal_payment_approved,
        );
      } else if (selectedStatus === "ready_to_complete") {
        filtered = filtered.filter(
          (booking) =>
            booking.status === "in_progress" &&
            booking.valuation_amount &&
            booking.normal_payment_approved,
        );
      } else {
        filtered = filtered.filter(
          (booking) => booking.status === selectedStatus,
        );
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (booking) =>
          (booking.customer_name?.toLowerCase() || "").includes(query) ||
          (booking.location?.toLowerCase() || "").includes(query) ||
          (booking.service_type?.toLowerCase() || "").includes(query) ||
          (booking.booking_id?.toLowerCase() || "").includes(query),
      );
    }

    setFilteredBookings(filtered);
  }, [bookings, selectedStatus, searchQuery]);

  const handleBookingPress = (booking) => {
    setSelectedBooking(booking);
    setDetailsModalVisible(true);
  };

  const handleValuationPress = (booking) => {
    setSelectedBooking(booking);
    setValuationAmount(booking.valuation_amount?.toString() || "");
    setValuationNotes("");
    setValuationModalVisible(true);
  };

  const handleSubmitValuation = async () => {
    if (!valuationAmount || parseFloat(valuationAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid valuation amount");
      return;
    }

    setSubmittingValuation(true);
    try {
      const token = await getAuthToken();

      const response = await fetch(
        `${BASE_URL}/api/bookings/${selectedBooking.booking_id}/valuation`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valuation_amount: parseFloat(valuationAmount),
          }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          "Success",
          `Valuation submitted for booking ${selectedBooking.booking_id}`,
          [
            {
              text: "OK",
              onPress: () => {
                setValuationModalVisible(false);
                fetchEngineerBookings();
              },
            },
          ],
        );
      } else {
        throw new Error(result.error || "Failed to submit valuation");
      }
    } catch (error) {
      console.error("Valuation error:", error);
      Alert.alert("Error", error.message || "Failed to submit valuation");
    } finally {
      setSubmittingValuation(false);
    }
  };

  const handleMarkCompleted = async (booking) => {
    if (!booking.normal_payment_approved) {
      Alert.alert(
        "Cannot Complete",
        "This booking cannot be completed yet. The customer's payment has not been approved by finance.",
      );
      return;
    }

    Alert.alert(
      "Mark as Completed",
      "Have you completed all work for this booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Complete",
          onPress: async () => {
            try {
              const token = await getAuthToken();

              const response = await fetch(
                `${BASE_URL}/api/bookings/${booking.booking_id}/completed`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                },
              );

              const result = await response.json();

              if (response.ok) {
                Alert.alert(
                  "Success",
                  result.message || "Booking marked as completed",
                );
                fetchEngineerBookings();
              } else {
                throw new Error(result.error || "Failed to mark as completed");
              }
            } catch (error) {
              console.error("Complete error:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to mark booking as completed",
              );
            }
          },
        },
      ],
    );
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "in_progress":
        return "#3b82f6";
      case "completed":
        return "#2d6a4f";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
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

  const getDisplayStatus = useCallback((status) => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status || "Unknown";
    }
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const formatCurrency = useCallback((amount) => {
    if (!amount) return "KES 0.00";
    return `KES ${parseFloat(amount).toLocaleString()}`;
  }, []);

  const renderStatCards = useCallback(() => {
    const cards = [
      {
        label: "Assigned",
        value: stats.total,
        icon: "briefcase-outline",
        color: "#2d6a4f",
      },
      {
        label: "Need Valuation",
        value: stats.pending_valuation,
        icon: "calculator-outline",
        color: "#f59e0b",
      },
      {
        label: "Awaiting Payment",
        value: stats.waiting_payment,
        icon: "card-outline",
        color: "#8b5cf6",
      },
      {
        label: "Ready to Complete",
        value: stats.ready_to_complete,
        icon: "checkmark-circle-outline",
        color: "#10b981",
      },
      {
        label: "Completed",
        value: stats.completed,
        icon: "checkmark-done-outline",
        color: "#2d6a4f",
      },
    ];

    return cards.map((card, index) => (
      <View
        key={`stat-${index}`}
        style={[styles.statCard, { borderLeftColor: card.color }]}
      >
        <Ionicons name={card.icon} size={24} color={card.color} />
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{card.value}</Text>
          <Text style={styles.statLabel}>{card.label}</Text>
        </View>
      </View>
    ));
  }, [stats]);

  const renderBookingCard = useCallback(
    ({ item }) => {
      const needsValuation =
        item.status === "in_progress" && !item.valuation_amount;
      const waitingForPayment =
        item.status === "in_progress" &&
        item.valuation_amount &&
        !item.normal_payment_approved;
      const readyToComplete =
        item.status === "in_progress" &&
        item.valuation_amount &&
        item.normal_payment_approved;

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleBookingPress(item)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.bookingIdContainer}>
              <Ionicons name="pricetag-outline" size={16} color="#2d6a4f" />
              <Text style={styles.bookingId}>{item.booking_id || "N/A"}</Text>
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
              <Text style={styles.statusText}>
                {getDisplayStatus(item.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.serviceType}>{item.service_type || "N/A"}</Text>

          <View style={styles.cardBody}>
            <View style={styles.infoGrid}>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {item.customer_name || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {item.location || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    Pref: {formatDate(item.preferred_date)}
                  </Text>
                </View>
              </View>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {item.email || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    Fee: {formatCurrency(item.booking_fee)}
                  </Text>
                </View>
                {item.valuation_amount && (
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="calculator-outline"
                      size={14}
                      color="#f59e0b"
                    />
                    <Text style={[styles.infoText, styles.valuationText]}>
                      Valuation: {formatCurrency(item.valuation_amount)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressStep,
                    { backgroundColor: "#f59e0b" },
                    needsValuation && styles.progressActive,
                  ]}
                >
                  <Ionicons name="calculator-outline" size={12} color="#fff" />
                </View>
                <View
                  style={[
                    styles.progressLine,
                    !needsValuation && styles.progressCompleted,
                  ]}
                />
                <View
                  style={[
                    styles.progressStep,
                    { backgroundColor: "#8b5cf6" },
                    waitingForPayment && styles.progressActive,
                  ]}
                >
                  <Ionicons name="card-outline" size={12} color="#fff" />
                </View>
                <View
                  style={[
                    styles.progressLine,
                    readyToComplete && styles.progressCompleted,
                  ]}
                />
                <View
                  style={[
                    styles.progressStep,
                    { backgroundColor: "#10b981" },
                    readyToComplete && styles.progressActive,
                  ]}
                >
                  <Ionicons name="checkmark-outline" size={12} color="#fff" />
                </View>
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Valuation</Text>
                <Text style={styles.progressLabel}>Payment</Text>
                <Text style={styles.progressLabel}>Complete</Text>
              </View>
            </View>

            {item.assignment_notes && (
              <View style={styles.notesContainer}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color="#64748b"
                />
                <Text style={styles.notesText} numberOfLines={2}>
                  {item.assignment_notes}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            {needsValuation && (
              <TouchableOpacity
                style={[styles.actionButton, styles.valuationButton]}
                onPress={() => handleValuationPress(item)}
              >
                <Ionicons name="calculator-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Submit Valuation</Text>
              </TouchableOpacity>
            )}

            {waitingForPayment && (
              <View
                style={[styles.statusMessage, { backgroundColor: "#8b5cf620" }]}
              >
                <Ionicons name="time-outline" size={18} color="#8b5cf6" />
                <Text style={[styles.statusMessageText, { color: "#8b5cf6" }]}>
                  Waiting for payment approval
                </Text>
              </View>
            )}

            {readyToComplete && (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={() => handleMarkCompleted(item)}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>Mark Completed</Text>
              </TouchableOpacity>
            )}

            {item.status === "completed" && (
              <View
                style={[styles.statusMessage, { backgroundColor: "#2d6a4f20" }]}
              >
                <Ionicons name="checkmark-circle" size={18} color="#2d6a4f" />
                <Text style={[styles.statusMessageText, { color: "#2d6a4f" }]}>
                  Completed
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [
      handleBookingPress,
      handleValuationPress,
      handleMarkCompleted,
      formatDate,
      formatCurrency,
      getDisplayStatus,
    ],
  );

  const renderDetailsModal = useCallback(
    () => (
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Booking Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalBody}>
                  <View style={styles.bookingSummary}>
                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Booking ID:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.booking_id}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Service:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.service_type}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Customer:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.customer_name}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Location:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.location}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Preferred Date:</Text>
                      <Text style={styles.summaryValue}>
                        {formatDate(selectedBooking.preferred_date)}
                      </Text>
                    </View>

                    {selectedBooking.description && (
                      <View style={styles.detailRow}>
                        <Text style={styles.summaryLabel}>Description:</Text>
                        <Text style={styles.summaryValue}>
                          {selectedBooking.description}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Booking Fee:</Text>
                      <Text style={styles.summaryValue}>
                        {formatCurrency(selectedBooking.booking_fee)}
                      </Text>
                    </View>

                    {selectedBooking.valuation_amount && (
                      <View style={styles.detailRow}>
                        <Text style={styles.summaryLabel}>
                          Valuation Amount:
                        </Text>
                        <Text
                          style={[styles.summaryValue, styles.valuationText]}
                        >
                          {formatCurrency(selectedBooking.valuation_amount)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Assigned Date:</Text>
                      <Text style={styles.summaryValue}>
                        {formatDateTime(selectedBooking.assigned_at)}
                      </Text>
                    </View>

                    {selectedBooking.assignment_notes && (
                      <View style={styles.detailRow}>
                        <Text style={styles.summaryLabel}>
                          Assignment Notes:
                        </Text>
                        <Text style={styles.summaryValue}>
                          {selectedBooking.assignment_notes}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Payment Status:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.normal_payment_approved
                          ? "✅ Payment Approved"
                          : selectedBooking.valuation_amount
                            ? "⏳ Awaiting Payment Approval"
                            : "N/A"}
                      </Text>
                    </View>
                  </View>

                  {selectedBooking.status === "in_progress" &&
                    !selectedBooking.valuation_amount && (
                      <TouchableOpacity
                        style={[styles.submitButton, { marginTop: 16 }]}
                        onPress={() => {
                          setDetailsModalVisible(false);
                          handleValuationPress(selectedBooking);
                        }}
                      >
                        <Ionicons
                          name="calculator-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.submitButtonText}>
                          Submit Valuation
                        </Text>
                      </TouchableOpacity>
                    )}

                  {selectedBooking.status === "in_progress" &&
                    selectedBooking.valuation_amount &&
                    selectedBooking.normal_payment_approved && (
                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          { marginTop: 16, backgroundColor: "#2d6a4f" },
                        ]}
                        onPress={() => {
                          setDetailsModalVisible(false);
                          handleMarkCompleted(selectedBooking);
                        }}
                      >
                        <Ionicons
                          name="checkmark-done-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.submitButtonText}>
                          Mark Completed
                        </Text>
                      </TouchableOpacity>
                    )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    ),
    [
      detailsModalVisible,
      selectedBooking,
      formatDate,
      formatDateTime,
      formatCurrency,
      handleValuationPress,
      handleMarkCompleted,
    ],
  );

  const renderValuationModal = useCallback(
    () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={valuationModalVisible}
        onRequestClose={() => setValuationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Valuation</Text>
              <TouchableOpacity onPress={() => setValuationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalBody}>
                  <View style={styles.bookingSummary}>
                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Booking ID:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.booking_id}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Service:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.service_type}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Customer:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.customer_name}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Location:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedBooking.location}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Booking Fee:</Text>
                      <Text style={styles.summaryValue}>
                        {formatCurrency(selectedBooking.booking_fee)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Valuation Amount (KES) *</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="Enter amount"
                      value={valuationAmount}
                      onChangeText={setValuationAmount}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                      style={styles.textArea}
                      placeholder="Add any notes about the valuation..."
                      value={valuationNotes}
                      onChangeText={setValuationNotes}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      submittingValuation && styles.disabledButton,
                    ]}
                    onPress={handleSubmitValuation}
                    disabled={submittingValuation}
                  >
                    {submittingValuation ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.submitButtonText}>
                          Submit Valuation
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    ),
    [
      valuationModalVisible,
      selectedBooking,
      valuationAmount,
      valuationNotes,
      submittingValuation,
      formatCurrency,
      handleSubmitValuation,
    ],
  );

  const bookingsToRender = useMemo(
    () => (Array.isArray(filteredBookings) ? filteredBookings : []),
    [filteredBookings],
  );

  const getFilterDisplayText = useCallback((status) => {
    switch (status) {
      case "all":
        return "All";
      case "in_progress":
        return "In Progress";
      case "pending_valuation":
        return "Need Valuation";
      case "waiting_payment":
        return "Awaiting Payment";
      case "ready_to_complete":
        return "Ready to Complete";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Nairobi Botanica</Text>
          <Text style={styles.title}>Engineer Dashboard</Text>
          {engineer && <Text style={styles.engineerName}>{engineer.name}</Text>}
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => setInventoryRequestsVisible(true)}
            style={[styles.refreshButton, { marginRight: 8 }]}
          >
            <Ionicons name="cube-outline" size={24} color="#2d6a4f" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={24} color="#2d6a4f" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
      >
        <View style={styles.statsContainer}>{renderStatCards()}</View>
      </ScrollView>

      <View style={styles.filterContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your bookings..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Status:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterChips}>
              {[
                "all",
                "in_progress",
                "pending_valuation",
                "waiting_payment",
                "ready_to_complete",
                "completed",
              ].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    selectedStatus === status && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedStatus === status && styles.filterChipTextActive,
                    ]}
                  >
                    {getFilterDisplayText(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2d6a4f" />
          <Text style={styles.loadingText}>Loading your assignments...</Text>
        </View>
      ) : (
        <FlatList
          data={bookingsToRender}
          renderItem={renderBookingCard}
          keyExtractor={(item) => item.booking_id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2d6a4f"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="construct-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No assignments yet</Text>
              <Text style={styles.emptySubtitle}>
                When the service manager assigns you bookings, they'll appear
                here
              </Text>
            </View>
          }
        />
      )}

      {renderValuationModal()}
      {renderDetailsModal()}
      {renderInventoryRequestsScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  greeting: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  engineerName: {
    fontSize: 14,
    color: "#2d6a4f",
    marginTop: 4,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  statsScroll: {
    maxHeight: 100,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: "#0f172a",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
    marginRight: 10,
  },
  filterChips: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#2d6a4f",
    borderColor: "#2d6a4f",
  },
  filterChipText: {
    fontSize: 12,
    color: "#475569",
    textTransform: "capitalize",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookingIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2d6a4f",
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
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  serviceType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
  },
  cardBody: {
    gap: 12,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
  },
  infoColumn: {
    flex: 1,
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#334155",
    flex: 1,
  },
  valuationText: {
    color: "#f59e0b",
    fontWeight: "600",
  },
  progressContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.3,
  },
  progressActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 4,
  },
  progressCompleted: {
    backgroundColor: "#2d6a4f",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  progressLabel: {
    fontSize: 9,
    color: "#64748b",
  },
  notesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  notesText: {
    fontSize: 11,
    color: "#64748b",
    flex: 1,
    fontStyle: "italic",
  },
  actionButtons: {
    marginTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  valuationButton: {
    backgroundColor: "#f59e0b",
  },
  completeButton: {
    backgroundColor: "#2d6a4f",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  statusMessageText: {
    fontSize: 14,
    fontWeight: "500",
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  modalBody: {
    padding: 20,
  },
  bookingSummary: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 0.4,
  },
  summaryValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    flex: 0.6,
    textAlign: "right",
  },
  formGroup: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#2d6a4f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 20,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Inventory specific styles
  inventoryItemsContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    gap: 12,
  },
  inventoryItemCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedInventoryItem: {
    backgroundColor: "#2d6a4f",
    borderColor: "#2d6a4f",
  },
  inventoryItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 8,
    marginBottom: 4,
  },
  inventoryItemStock: {
    fontSize: 12,
    color: "#64748b",
  },
  inventoryItemStatus: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  selectedInventoryItemText: {
    color: "#fff",
  },
  stockInfo: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
  },
  stockValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2d6a4f",
    textAlign: "center",
  },
});

export default EngineerDashboard;

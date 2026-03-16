// app/inventory_manager/requests.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
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

const InventoryRequests = () => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manager, setManager] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  // Approval/Rejection Modal
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'

  // Request Details Modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    loadManagerData();
  }, []);

  useEffect(() => {
    if (manager) {
      fetchRequests();
    }
  }, [manager]);

  useEffect(() => {
    filterRequests();
  }, [requests, selectedStatus, searchQuery]);

  const loadManagerData = async () => {
    try {
      const userStr = await AsyncStorage.getItem("user");

      if (!userStr) {
        Alert.alert("Error", "Please login again");
        return;
      }

      const user = JSON.parse(userStr);

      if (user.role !== "inventory_manager" && user.role !== "admin") {
        Alert.alert(
          "Access Denied",
          "You don't have permission to access this page",
        );
        return;
      }

      setManager(user);
    } catch (error) {
      console.error("Error loading manager data:", error);
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

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      console.log("Fetching from:", `${BASE_URL}/api/inventory/requests`); // Debug log

      const response = await fetch(`${BASE_URL}/api/inventory/requests`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status); // Debug log

      if (!response.ok) {
        if (response.status === 401) {
          Alert.alert("Session Expired", "Please login again");
          // Handle logout here if needed
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received data:", data); // Debug log

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

      setStats({
        pending,
        approved,
        rejected,
        total: requestsArray.length,
      });
    } catch (error) {
      console.error("Fetch requests error:", error);
      Alert.alert(
        "Error",
        `Failed to fetch inventory requests: ${error.message}`,
      );
      setRequests([]);
      setStats({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, []);

  const filterRequests = useCallback(() => {
    const requestsArray = Array.isArray(requests) ? requests : [];
    let filtered = [...requestsArray];

    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (request) => request.status === selectedStatus,
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          (request.item_name?.toLowerCase() || "").includes(query) ||
          (request.engineer_name?.toLowerCase() || "").includes(query) ||
          (request.id?.toLowerCase() || "").includes(query),
      );
    }

    setFilteredRequests(filtered);
  }, [requests, selectedStatus, searchQuery]);

  const handleApprovePress = (request) => {
    setSelectedRequest(request);
    setActionType("approve");
    setRejectionReason("");
    setActionModalVisible(true);
  };

  const handleRejectPress = (request) => {
    setSelectedRequest(request);
    setActionType("reject");
    setRejectionReason("");
    setActionModalVisible(true);
  };

  const handleRequestPress = (request) => {
    setSelectedRequest(request);
    setDetailsModalVisible(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest) return;

    if (actionType === "reject" && !rejectionReason.trim()) {
      Alert.alert("Error", "Please provide a reason for rejection");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const endpoint =
        actionType === "approve"
          ? `${BASE_URL}/api/inventory/request/approve/${selectedRequest.id}`
          : `${BASE_URL}/api/inventory/request/reject/${selectedRequest.id}`;

      console.log("Submitting to:", endpoint); // Debug log

      const body =
        actionType === "approve"
          ? { manager_id: manager.id }
          : { manager_id: manager.id, reason: rejectionReason.trim() };

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log("Response status:", response.status); // Debug log

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          "Success",
          actionType === "approve"
            ? "Request approved successfully"
            : "Request rejected successfully",
          [
            {
              text: "OK",
              onPress: () => {
                setActionModalVisible(false);
                fetchRequests();
              },
            },
          ],
        );
      } else {
        throw new Error(result.error || `Failed to ${actionType} request`);
      }
    } catch (error) {
      console.error(`${actionType} error:`, error);
      Alert.alert("Error", error.message || `Failed to ${actionType} request`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
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

  const getStatusIcon = (status) => {
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

  const renderStatCards = () => {
    const cards = [
      {
        label: "Pending",
        value: stats.pending,
        icon: "time-outline",
        color: "#f59e0b",
      },
      {
        label: "Approved",
        value: stats.approved,
        icon: "checkmark-circle-outline",
        color: "#10b981",
      },
      {
        label: "Rejected",
        value: stats.rejected,
        icon: "close-circle-outline",
        color: "#ef4444",
      },
      {
        label: "Total",
        value: stats.total,
        icon: "cube-outline",
        color: "#64748b",
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
  };

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
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Ionicons name={getStatusIcon(item.status)} size={12} color="#fff" />
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
              <Ionicons name="person-outline" size={14} color="#64748b" />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.engineer_name || "Unknown Engineer"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>
                Qty: {item.requested_quantity || 0}
              </Text>
            </View>
          </View>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>
                {formatDateTime(item.created_at)}
              </Text>
            </View>
            {item.approved_at && (
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                <Text style={styles.infoText}>
                  {formatDateTime(item.approved_at)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {item.rejection_reason && (
          <View style={styles.notesContainer}>
            <Ionicons name="alert-circle" size={14} color="#ef4444" />
            <Text
              style={[styles.notesText, { color: "#ef4444" }]}
              numberOfLines={2}
            >
              {item.rejection_reason}
            </Text>
          </View>
        )}
      </View>

      {item.status === "pending" && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprovePress(item)}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectPress(item)}
          >
            <Ionicons name="close-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderActionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={actionModalVisible}
      onRequestClose={() => setActionModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {actionType === "approve" ? "Approve Request" : "Reject Request"}
            </Text>
            <TouchableOpacity onPress={() => setActionModalVisible(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalBody}>
              {selectedRequest && (
                <>
                  <View style={styles.requestSummary}>
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
                      <Text style={styles.summaryLabel}>Engineer:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedRequest.engineer_name}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Quantity:</Text>
                      <Text style={styles.summaryValue}>
                        {selectedRequest.requested_quantity}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.summaryLabel}>Requested:</Text>
                      <Text style={styles.summaryValue}>
                        {formatDateTime(selectedRequest.created_at)}
                      </Text>
                    </View>
                  </View>

                  {actionType === "reject" && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Rejection Reason *</Text>
                      <TextInput
                        style={styles.textArea}
                        placeholder="Enter reason for rejection..."
                        value={rejectionReason}
                        onChangeText={setRejectionReason}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      actionType === "approve"
                        ? styles.approveButton
                        : styles.rejectButton,
                      submitting && styles.disabledButton,
                    ]}
                    onPress={handleSubmitAction}
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
                          name={
                            actionType === "approve"
                              ? "checkmark-circle"
                              : "close-circle"
                          }
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.submitButtonText}>
                          {actionType === "approve"
                            ? "Confirm Approval"
                            : "Confirm Rejection"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderDetailsModal = () => (
    <Modal
      visible={detailsModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setDetailsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {selectedRequest && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <View style={styles.detailsContainer}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Request ID:</Text>
                    <Text style={styles.detailValue}>{selectedRequest.id}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Item:</Text>
                    <Text style={styles.detailValue}>
                      {selectedRequest.item_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Engineer:</Text>
                    <Text style={styles.detailValue}>
                      {selectedRequest.engineer_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Quantity:</Text>
                    <Text style={styles.detailValue}>
                      {selectedRequest.requested_quantity}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusColor(
                            selectedRequest.status,
                          ),
                        },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(selectedRequest.status)}
                        size={12}
                        color="#fff"
                      />
                      <Text style={styles.statusText}>
                        {selectedRequest.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Requested Date:</Text>
                    <Text style={styles.detailValue}>
                      {formatDateTime(selectedRequest.created_at)}
                    </Text>
                  </View>

                  {selectedRequest.approved_at && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Approved Date:</Text>
                      <Text style={styles.detailValue}>
                        {formatDateTime(selectedRequest.approved_at)}
                      </Text>
                    </View>
                  )}

                  {selectedRequest.rejection_reason && (
                    <View style={styles.rejectionContainer}>
                      <Text style={styles.rejectionLabel}>
                        Rejection Reason:
                      </Text>
                      <Text style={styles.rejectionText}>
                        {selectedRequest.rejection_reason}
                      </Text>
                    </View>
                  )}
                </View>

                {selectedRequest.status === "pending" && (
                  <View style={styles.modalActionButtons}>
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.approveButton]}
                      onPress={() => {
                        setDetailsModalVisible(false);
                        handleApprovePress(selectedRequest);
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.rejectButton]}
                      onPress={() => {
                        setDetailsModalVisible(false);
                        handleRejectPress(selectedRequest);
                      }}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const getFilterDisplayText = (status) => {
    switch (status) {
      case "all":
        return "All";
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Nairobi Botanica</Text>
          <Text style={styles.title}>Inventory Requests</Text>
          {manager && <Text style={styles.managerName}>{manager.name}</Text>}
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#2d6a4f" />
        </TouchableOpacity>
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
            placeholder="Search by item, engineer, or ID..."
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
              {["all", "pending", "approved", "rejected"].map((status) => (
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
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2d6a4f"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No requests found</Text>
              <Text style={styles.emptySubtitle}>
                When engineers create inventory requests, they'll appear here
              </Text>
            </View>
          }
        />
      )}

      {renderActionModal()}
      {renderDetailsModal()}
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
  managerName: {
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
  notesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  notesText: {
    fontSize: 11,
    flex: 1,
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: "#10b981",
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
  requestSummary: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 100,
    textAlignVertical: "top",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  detailsContainer: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    flex: 0.4,
  },
  detailValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
    flex: 0.6,
    textAlign: "right",
  },
  rejectionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    gap: 8,
  },
  rejectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  rejectionText: {
    fontSize: 14,
    color: "#7f1d1d",
  },
  modalActionButtons: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
});

export default InventoryRequests;

// app/service_manager/dashboard.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
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

const ServiceManagerDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [serviceManager, setServiceManager] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });

  useEffect(() => {
    loadServiceManager();
  }, []);

  useEffect(() => {
    if (serviceManager) {
      fetchBookings();
      fetchEngineersWithStatus();
    }
  }, [serviceManager]);

  useEffect(() => {
    filterBookings();
  }, [bookings, selectedStatus, searchQuery]);

  const loadServiceManager = async () => {
    try {
      const userStr = await AsyncStorage.getItem("user");

      if (!userStr) {
        Alert.alert("Error", "Please login again");
        return;
      }

      const user = JSON.parse(userStr);

      if (user.role !== "service_manager" && user.role !== "admin") {
        Alert.alert(
          "Access Denied",
          "You don't have permission to access this page",
        );
        return;
      }

      setServiceManager(user);
    } catch (error) {
      console.error("Error loading service manager:", error);
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
      setLoading(true);
      const token = await getAuthToken();

      const response = await fetch(`${BASE_URL}/api/bookings/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched bookings data:", data);

      const bookingsArray = Array.isArray(data) ? data : [];
      setBookings(bookingsArray);

      const newStats = {
        total: bookingsArray.length,
        pending: bookingsArray.filter((b) => b?.status === "pending").length,
        approved: bookingsArray.filter((b) => b?.status === "approved").length,
        in_progress: bookingsArray.filter((b) => b?.status === "in_progress")
          .length,
        completed: bookingsArray.filter((b) => b?.status === "completed")
          .length,
        cancelled: bookingsArray.filter((b) => b?.status === "cancelled")
          .length,
      };
      setStats(newStats);
    } catch (error) {
      console.error("Fetch bookings error:", error);
      Alert.alert("Error", "Failed to fetch bookings");
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchEngineersWithStatus = async () => {
    try {
      const token = await getAuthToken();

      const response = await fetch(
        `${BASE_URL}/api/bookings/engineers/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        console.warn("Failed to fetch engineers with status");
        await fetchEngineersFallback();
        return;
      }

      const data = await response.json();
      console.log("Engineers with status:", data);

      let engineersArray = [];
      if (Array.isArray(data)) {
        engineersArray = data;
      } else if (data.data && Array.isArray(data.data)) {
        engineersArray = data.data;
      }

      setEngineers(engineersArray);
    } catch (error) {
      console.error("Error fetching engineers with status:", error);
      await fetchEngineersFallback();
    }
  };

  const fetchEngineersFallback = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${BASE_URL}/api/admin/users?role=engineer`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        setEngineers([]);
        return;
      }

      const data = await response.json();

      let engineersArray = [];
      if (Array.isArray(data)) {
        engineersArray = data;
      } else if (data.users && Array.isArray(data.users)) {
        engineersArray = data.users;
      } else if (data.data && Array.isArray(data.data)) {
        engineersArray = data.data;
      }

      engineersArray = engineersArray.map((eng) => ({
        id: eng.id,
        name: eng.name,
        email: eng.email,
        account_status: eng.status || "active",
        work_status: "available",
      }));

      setEngineers(engineersArray);
    } catch (error) {
      console.error("Error in fetchEngineersFallback:", error);
      setEngineers([]);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
    fetchEngineersWithStatus();
  }, []);

  const filterBookings = useCallback(() => {
    const bookingsArray = Array.isArray(bookings) ? bookings : [];
    let filtered = [...bookingsArray];

    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (booking) => booking?.status === selectedStatus,
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (booking) =>
          (booking?.customer_name?.toLowerCase() || "").includes(query) ||
          (booking?.location?.toLowerCase() || "").includes(query) ||
          (booking?.service_type?.toLowerCase() || "").includes(query) ||
          (booking?.booking_id?.toLowerCase() || "").includes(query) ||
          (booking?.email?.toLowerCase() || "").includes(query),
      );
    }

    setFilteredBookings(filtered);
  }, [bookings, selectedStatus, searchQuery]);

  const handleApproveBooking = async (booking) => {
    Alert.alert(
      "Approve Booking",
      `Are you sure you want to approve booking ${booking.booking_id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              const token = await getAuthToken();

              const response = await fetch(
                `${BASE_URL}/api/bookings/${booking.booking_id}/status`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: "approved" }),
                },
              );

              const result = await response.json();

              if (response.ok) {
                Alert.alert(
                  "Success",
                  result.message || "Booking approved successfully",
                );
                fetchBookings();
              } else {
                throw new Error(result.error || "Failed to approve booking");
              }
            } catch (error) {
              console.error("Approve error:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to approve booking",
              );
            }
          },
        },
      ],
    );
  };

  const handleCancelBooking = async (booking) => {
    Alert.alert(
      "Cancel Booking",
      `Are you sure you want to cancel booking ${booking.booking_id}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();

              const response = await fetch(
                `${BASE_URL}/api/bookings/${booking.booking_id}/status`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: "cancelled" }),
                },
              );

              const result = await response.json();

              if (response.ok) {
                Alert.alert(
                  "Success",
                  result.message || "Booking cancelled successfully",
                );
                fetchBookings();
              } else {
                throw new Error(result.error || "Failed to cancel booking");
              }
            } catch (error) {
              console.error("Cancel error:", error);
              Alert.alert("Error", error.message || "Failed to cancel booking");
            }
          },
        },
      ],
    );
  };

  const handleAssignPress = (booking) => {
    if (booking.status !== "approved") {
      Alert.alert(
        "Error",
        "Only approved bookings can be assigned to engineers",
      );
      return;
    }

    // Check for available engineers based on both account status and work status
    const availableEngineers = engineers.filter((eng) => {
      const accountActive = eng.account_status === "active";
      const workAvailable = eng.work_status === "available";
      return accountActive && workAvailable;
    });

    if (availableEngineers.length === 0) {
      // Check if there are any engineers at all
      if (engineers.length === 0) {
        Alert.alert(
          "No Engineers",
          "No engineers are registered in the system. Please contact admin.",
        );
        return;
      }

      // Check if engineers are suspended
      const suspendedEngineers = engineers.filter(
        (eng) => eng.account_status === "suspended",
      );

      if (
        suspendedEngineers.length > 0 &&
        engineers.length === suspendedEngineers.length
      ) {
        Alert.alert(
          "All Engineers Suspended",
          "All engineers are currently suspended. Please contact admin to activate engineers.",
        );
        return;
      }

      // Check if all active engineers are busy
      const busyEngineers = engineers.filter(
        (eng) =>
          eng.account_status === "active" && eng.work_status === "active",
      );

      if (busyEngineers.length > 0) {
        Alert.alert(
          "No Available Engineers",
          `All ${busyEngineers.length} active engineer(s) are currently busy with other bookings. Please try again later when an engineer becomes available.`,
        );
      } else {
        Alert.alert(
          "No Available Engineers",
          "No engineers are currently available for assignment.",
        );
      }
      return;
    }

    setSelectedBooking(booking);
    setSelectedEngineer("");
    setAssignmentNotes("");
    setModalVisible(true);
  };

  const handleAssignConfirm = async () => {
    if (!selectedEngineer) {
      Alert.alert("Error", "Please select an engineer");
      return;
    }

    // Double-check engineer availability before confirming
    const selectedEng = engineers.find((eng) => eng.id === selectedEngineer);

    if (!selectedEng) {
      Alert.alert("Error", "Selected engineer not found");
      return;
    }

    if (selectedEng.account_status !== "active") {
      Alert.alert(
        "Engineer Suspended",
        "This engineer account is suspended. Please select an active engineer.",
      );
      return;
    }

    if (selectedEng.work_status !== "available") {
      Alert.alert(
        "Engineer Unavailable",
        "This engineer is currently busy with another booking. Please select an available engineer.",
        [{ text: "OK", onPress: () => fetchEngineersWithStatus() }],
      );
      return;
    }

    setAssigning(true);
    try {
      const token = await getAuthToken();

      const response = await fetch(
        `${BASE_URL}/api/bookings/${selectedBooking.booking_id}/assign-engineer`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            engineer_id: selectedEngineer,
            assigned_by: serviceManager?.id || "SERVICE_MANAGER",
            notes: assignmentNotes,
          }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          "Success",
          result.message || "Engineer assigned successfully",
          [
            {
              text: "OK",
              onPress: () => {
                setModalVisible(false);
                fetchBookings();
                fetchEngineersWithStatus();
              },
            },
          ],
        );
      } else {
        // Handle specific error messages from backend
        if (result.error?.includes("suspended")) {
          Alert.alert(
            "Engineer Suspended",
            "This engineer account is suspended. Please select an active engineer.",
            [{ text: "OK", onPress: () => fetchEngineersWithStatus() }],
          );
        } else if (result.error?.includes("already has an active booking")) {
          Alert.alert(
            "Engineer Unavailable",
            "This engineer already has an active booking in progress. Please select a different engineer.",
            [{ text: "OK", onPress: () => fetchEngineersWithStatus() }],
          );
        } else {
          throw new Error(result.error || "Failed to assign engineer");
        }
      }
    } catch (error) {
      console.error("Assignment error:", error);
      Alert.alert("Error", error.message || "Failed to assign engineer");
    } finally {
      setAssigning(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "#f59e0b";
      case "approved":
        return "#10b981";
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

  const getEngineerStatusColor = (accountStatus, workStatus) => {
    if (accountStatus !== "active") return "#ef4444"; // Red for suspended
    return workStatus === "available" ? "#10b981" : "#f59e0b"; // Green for available, orange for busy
  };

  const getEngineerStatusText = (engineer) => {
    if (engineer.account_status !== "active") {
      return "Suspended";
    }
    return engineer.work_status === "available" ? "Available" : "Busy";
  };

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

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

  const formatCurrency = useCallback((amount) => {
    if (!amount) return "KES 0.00";
    return `KES ${parseFloat(amount).toLocaleString()}`;
  }, []);

  const renderStatCards = useCallback(() => {
    const cards = [
      {
        label: "Total",
        value: stats.total,
        icon: "calendar-outline",
        color: "#2d6a4f",
      },
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
        label: "In Progress",
        value: stats.in_progress,
        icon: "construct-outline",
        color: "#3b82f6",
      },
      {
        label: "Completed",
        value: stats.completed,
        icon: "checkmark-done-outline",
        color: "#2d6a4f",
      },
      {
        label: "Cancelled",
        value: stats.cancelled,
        icon: "close-circle-outline",
        color: "#ef4444",
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
      const canApprove = item.status === "pending";
      const canCancel = item.status === "pending" || item.status === "approved";
      const canAssign = item.status === "approved";

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.bookingIdContainer}>
              <Ionicons name="pricetag-outline" size={16} color="#2d6a4f" />
              <Text style={styles.bookingId}>{item?.booking_id || "N/A"}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item?.status) },
              ]}
            >
              <Ionicons
                name={getStatusIcon(item?.status)}
                size={12}
                color="#fff"
              />
              <Text style={styles.statusText}>{item?.status || "unknown"}</Text>
            </View>
          </View>

          <Text style={styles.serviceType}>{item?.service_type || "N/A"}</Text>

          <View style={styles.cardBody}>
            <View style={styles.infoGrid}>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    {item?.customer_name || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>{item?.location || "N/A"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    Pref: {formatDate(item?.preferred_date)}
                  </Text>
                </View>
              </View>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {item?.email || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    Fee: {formatCurrency(item?.booking_fee)}
                  </Text>
                </View>
                {item?.valuation_amount && (
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

            {item?.engineer_name && (
              <View style={styles.engineerInfo}>
                <Ionicons name="construct-outline" size={14} color="#2d6a4f" />
                <Text style={styles.engineerText}>
                  Engineer: {item.engineer_name}
                </Text>
              </View>
            )}

            {item?.assignment_notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{item.assignment_notes}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            {canApprove && (
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApproveBooking(item)}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
            )}

            {canAssign && (
              <TouchableOpacity
                style={[styles.actionButton, styles.assignButton]}
                onPress={() => handleAssignPress(item)}
              >
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Assign</Text>
              </TouchableOpacity>
            )}

            {canCancel && (
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleCancelBooking(item)}
              >
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            {item.status === "in_progress" && (
              <View
                style={[styles.statusChip, { backgroundColor: "#3b82f620" }]}
              >
                <Ionicons name="construct-outline" size={16} color="#3b82f6" />
                <Text style={[styles.statusChipText, { color: "#3b82f6" }]}>
                  In Progress
                </Text>
              </View>
            )}

            {item.status === "completed" && (
              <View
                style={[styles.statusChip, { backgroundColor: "#2d6a4f20" }]}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={16}
                  color="#2d6a4f"
                />
                <Text style={[styles.statusChipText, { color: "#2d6a4f" }]}>
                  Completed
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [
      formatDate,
      formatCurrency,
      handleApproveBooking,
      handleCancelBooking,
      handleAssignPress,
    ],
  );

  const bookingsToRender = useMemo(
    () => (Array.isArray(filteredBookings) ? filteredBookings : []),
    [filteredBookings],
  );

  const getFilterDisplayText = useCallback((status) => {
    if (status === "in_progress") return "In Progress";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, []);

  // Separate engineers by availability for better display
  const availableEngineers = useMemo(() => {
    return engineers.filter(
      (eng) =>
        eng.account_status === "active" && eng.work_status === "available",
    );
  }, [engineers]);

  const busyEngineers = useMemo(() => {
    return engineers.filter(
      (eng) => eng.account_status === "active" && eng.work_status === "active",
    );
  }, [engineers]);

  const suspendedEngineers = useMemo(() => {
    return engineers.filter((eng) => eng.account_status !== "active");
  }, [engineers]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Nairobi Botanica</Text>
          <Text style={styles.title}>Service Manager Dashboard</Text>
          {serviceManager && (
            <Text style={styles.managerName}>{serviceManager.name}</Text>
          )}
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
            placeholder="Search bookings..."
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
                "pending",
                "approved",
                "in_progress",
                "completed",
                "cancelled",
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
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={bookingsToRender}
          renderItem={renderBookingCard}
          keyExtractor={(item) => item?.booking_id || Math.random().toString()}
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
              <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptySubtitle}>
                Bookings will appear here when customers make requests
              </Text>
            </View>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Engineer</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalBody}>
                  <View style={styles.bookingSummary}>
                    <Text style={styles.summaryLabel}>Booking ID:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedBooking.booking_id}
                    </Text>

                    <Text style={styles.summaryLabel}>Service:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedBooking.service_type}
                    </Text>

                    <Text style={styles.summaryLabel}>Customer:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedBooking.customer_name}
                    </Text>

                    <Text style={styles.summaryLabel}>Location:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedBooking.location}
                    </Text>

                    <Text style={styles.summaryLabel}>Preferred Date:</Text>
                    <Text style={styles.summaryValue}>
                      {formatDate(selectedBooking.preferred_date)}
                    </Text>
                  </View>

                  {/* Engineer Status Summary */}
                  <View style={styles.engineerStatusSummary}>
                    <View style={styles.statusSummaryItem}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: "#10b981" },
                        ]}
                      />
                      <Text style={styles.statusSummaryText}>
                        Available: {availableEngineers.length}
                      </Text>
                    </View>
                    <View style={styles.statusSummaryItem}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: "#f59e0b" },
                        ]}
                      />
                      <Text style={styles.statusSummaryText}>
                        Busy: {busyEngineers.length}
                      </Text>
                    </View>
                    <View style={styles.statusSummaryItem}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: "#ef4444" },
                        ]}
                      />
                      <Text style={styles.statusSummaryText}>
                        Suspended: {suspendedEngineers.length}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Select Engineer *</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedEngineer}
                        onValueChange={(itemValue) =>
                          setSelectedEngineer(itemValue)
                        }
                        style={styles.picker}
                      >
                        <Picker.Item label="Choose an engineer..." value="" />

                        {/* Available Engineers - Green */}
                        {availableEngineers.map((engineer) => (
                          <Picker.Item
                            key={engineer.id}
                            label={`${engineer.name} (Available)`}
                            value={engineer.id}
                            color="#10b981"
                          />
                        ))}

                        {/* Busy Engineers - Orange (Disabled in selection but shown for info) */}
                        {busyEngineers.length > 0 && (
                          <Picker.Item
                            label="--- Busy Engineers (Unavailable) ---"
                            value="busy-separator"
                            enabled={false}
                            color="#64748b"
                          />
                        )}
                        {busyEngineers.map((engineer) => (
                          <Picker.Item
                            key={engineer.id}
                            label={`${engineer.name} (Busy)`}
                            value={engineer.id}
                            color="#f59e0b"
                          />
                        ))}

                        {/* Suspended Engineers - Red (Disabled) */}
                        {suspendedEngineers.length > 0 && (
                          <Picker.Item
                            label="--- Suspended Engineers (Inactive) ---"
                            value="suspended-separator"
                            enabled={false}
                            color="#64748b"
                          />
                        )}
                        {suspendedEngineers.map((engineer) => (
                          <Picker.Item
                            key={engineer.id}
                            label={`${engineer.name} (Suspended)`}
                            value={engineer.id}
                            color="#ef4444"
                          />
                        ))}
                      </Picker>
                    </View>

                    {/* Warning message if no available engineers */}
                    {availableEngineers.length === 0 && (
                      <View style={styles.warningContainer}>
                        <Ionicons
                          name="warning-outline"
                          size={20}
                          color="#ef4444"
                        />
                        <Text style={styles.warningText}>
                          {engineers.length === 0
                            ? "No engineers found in the system."
                            : busyEngineers.length > 0
                              ? "All active engineers are currently busy. Please try again later."
                              : "No active engineers available. Please contact admin."}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Assignment Notes</Text>
                    <TextInput
                      style={styles.textArea}
                      placeholder="Add any special instructions or notes..."
                      value={assignmentNotes}
                      onChangeText={setAssignmentNotes}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      (assigning ||
                        !selectedEngineer ||
                        availableEngineers.length === 0) &&
                        styles.disabledButton,
                    ]}
                    onPress={handleAssignConfirm}
                    disabled={
                      assigning ||
                      !selectedEngineer ||
                      availableEngineers.length === 0
                    }
                  >
                    {assigning ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.confirmButtonText}>
                          Confirm Assignment
                        </Text>
                      </>
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
    minWidth: 110,
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
    fontSize: 13,
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
    marginBottom: 12,
  },
  bookingIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bookingId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2d6a4f",
    letterSpacing: 0.5,
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
    marginBottom: 12,
    gap: 8,
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
  engineerInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9f0",
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  engineerText: {
    fontSize: 12,
    color: "#2d6a4f",
    fontWeight: "500",
  },
  notesContainer: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 11,
    color: "#334155",
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
    gap: 4,
    minWidth: 80,
  },
  approveButton: {
    backgroundColor: "#10b981",
  },
  assignButton: {
    backgroundColor: "#3b82f6",
  },
  cancelButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  statusChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
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
  modalContainer: {
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
    marginBottom: 20,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    marginBottom: 8,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 80,
  },
  confirmButton: {
    backgroundColor: "#2d6a4f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  engineerStatusHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    fontStyle: "italic",
  },
  engineerStatusSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusSummaryText: {
    fontSize: 12,
    color: "#334155",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#ef4444",
  },
});

export default ServiceManagerDashboard;

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { BASE_URL } from "../../config";

export default function Manage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const res = await axios.get(`${BASE_URL}/api/admin/users`);
      const list = res.data.users || res.data || [];

      // Filter out admin users
      const nonAdminUsers = list.filter(
        (u) => u.role?.toLowerCase() !== "admin",
      );

      setUsers(nonAdminUsers);
      setFilteredUsers(nonAdminUsers);
    } catch (err) {
      console.error("Error loading users:", err);
      Alert.alert("Error", "Failed to fetch users. Check your API route.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, [fetchUsers]);

  const getUserId = (user) =>
    user.userid || user.user_id || user.id || user._id || "N/A";

  const normalizeStatus = (status) =>
    status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Unknown";

  const handleSearch = (text) => {
    setSearch(text);
    const term = text.toLowerCase();

    const filtered = users.filter(
      (u) =>
        u.role?.toLowerCase() !== "admin" &&
        (u.role?.toLowerCase().includes(term) ||
          getUserId(u).toString().includes(term)),
    );

    setFilteredUsers(filtered);
    setPage(1);
  };

  // 🔹 Fetch full user details on row press
  const handleRowPress = async (user) => {
    try {
      setLoadingUser(true);
      const res = await axios.get(
        `${BASE_URL}/api/admin/users/${getUserId(user)}`,
      );
      setSelectedUser(res.data);
      setModalVisible(true);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load user details.");
    } finally {
      setLoadingUser(false);
    }
  };

  const handleAction = async (action) => {
    if (!selectedUser) return;
    let newStatus;

    const current = selectedUser.status?.toLowerCase();

    switch (action) {
      case "suspend":
        newStatus = "Suspended";
        break;
      case "approve":
        newStatus = "Active";
        break;
      case "decline":
        newStatus = "Declined";
        break;
      case "reactivate":
        newStatus = current === "declined" ? "Pending" : "Active";
        break;
      default:
        return;
    }

    Alert.alert("Confirm", `Are you sure you want to ${action} this account?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const id = getUserId(selectedUser);
            await axios.put(`${BASE_URL}/api/admin/users/${id}`, {
              status: newStatus,
            });
            setSelectedUser({ ...selectedUser, status: newStatus });
            fetchUsers();
            Alert.alert("Success", `User status updated to ${newStatus}.`);
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to update user status.");
          }
        },
      },
    ]);
  };

  const paginatedData = filteredUsers.slice(
    (page - 1) * perPage,
    page * perPage,
  );

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "green";
      case "pending":
        return "#facc15";
      case "suspended":
        return "red";
      case "declined":
        return "#a1a1aa";
      default:
        return "#000";
    }
  };

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, { flex: 2 }]}>Name</Text>
      <Text style={[styles.headerCell, { flex: 1 }]}>User ID</Text>
      <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
    </View>
  );

  const renderRow = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => handleRowPress(item)}>
      <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>
        {item.name || item.fullname || "N/A"}
      </Text>
      <Text style={[styles.cell, { flex: 1 }]}>{getUserId(item)}</Text>
      <Text
        style={[styles.cell, { flex: 1, color: getStatusColor(item.status) }]}
      >
        {normalizeStatus(item.status)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Users</Text>

      <TextInput
        placeholder="Search by role or user ID..."
        placeholderTextColor="#9ca3af"
        value={search}
        onChangeText={handleSearch}
        style={styles.searchInput}
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#2563eb"
          style={{ marginTop: 50 }}
        />
      ) : (
        <>
          <FlatList
            data={paginatedData}
            keyExtractor={(item, index) =>
              getUserId(item) !== "N/A"
                ? getUserId(item).toString()
                : index.toString()
            }
            ListHeaderComponent={renderHeader}
            renderItem={renderRow}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No users found</Text>
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
          />

          <View style={styles.pagination}>
            <TouchableOpacity
              disabled={page === 1}
              onPress={() => setPage((p) => Math.max(p - 1, 1))}
              style={[styles.pageBtn, page === 1 && { opacity: 0.5 }]}
            >
              <Text style={styles.pageText}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageText}>
              Page {page} / {Math.ceil(filteredUsers.length / perPage) || 1}
            </Text>
            <TouchableOpacity
              disabled={page * perPage >= filteredUsers.length}
              onPress={() => setPage((p) => p + 1)}
              style={[
                styles.pageBtn,
                page * perPage >= filteredUsers.length && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.pageText}>Next</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard}>
            {loadingUser ? (
              <ActivityIndicator
                size="large"
                color="#2563eb"
                style={{ marginTop: 50 }}
              />
            ) : selectedUser ? (
              <>
                <Text style={styles.modalHeader}>User Details</Text>

                <Text style={styles.label}>
                  NAME:{" "}
                  <Text style={styles.value}>
                    {selectedUser.name || selectedUser.fullname || "N/A"}
                  </Text>
                </Text>
                <Text style={styles.label}>
                  USER ID:{" "}
                  <Text style={styles.value}>{getUserId(selectedUser)}</Text>
                </Text>
                <Text style={styles.label}>
                  EMAIL:{" "}
                  <Text style={styles.value}>
                    {selectedUser.email || "N/A"}
                  </Text>
                </Text>
                <Text style={styles.label}>
                  PHONE:{" "}
                  <Text style={styles.value}>
                    {selectedUser.phone || "N/A"}
                  </Text>
                </Text>
                <Text style={styles.label}>
                  DOB:{" "}
                  <Text style={styles.value}>
                    {selectedUser.dob
                      ? new Date(selectedUser.dob).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </Text>
                </Text>
                <Text style={styles.label}>
                  ROLE:{" "}
                  <Text style={styles.value}>{selectedUser.role || "N/A"}</Text>
                </Text>
                <Text style={styles.label}>
                  STATUS:{" "}
                  <Text
                    style={[
                      styles.value,
                      { color: getStatusColor(selectedUser.status) },
                    ]}
                  >
                    {normalizeStatus(selectedUser.status)}
                  </Text>
                </Text>

                <View style={styles.actions}>
                  {selectedUser.status?.toLowerCase() === "active" && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleAction("suspend")}
                    >
                      <Text style={styles.actionText}>Suspend</Text>
                    </TouchableOpacity>
                  )}
                  {selectedUser.status?.toLowerCase() === "pending" && (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleAction("approve")}
                      >
                        <Text style={styles.actionText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: "#f87171" },
                        ]}
                        onPress={() => handleAction("decline")}
                      >
                        <Text style={styles.actionText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {["suspended", "declined"].includes(
                    selectedUser.status?.toLowerCase(),
                  ) && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleAction("reactivate")}
                    >
                      <Text style={styles.actionText}>Reactivate</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#6b7280" }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.actionText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    backgroundColor: "#e2e8f0",
  },
  headerCell: { fontWeight: "700", fontSize: 14 },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cell: { fontSize: 14 },
  emptyText: { textAlign: "center", marginTop: 20, color: "#94a3b8" },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 12,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#2563eb",
    marginHorizontal: 4,
    borderRadius: 6,
  },
  pageText: { color: "#fff", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    maxHeight: "85%",
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 12,
  },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  value: { fontWeight: "400", color: "#111" },
  actions: { flexDirection: "row", flexWrap: "wrap", marginTop: 16 },
  actionBtn: {
    backgroundColor: "#2563eb",
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: { color: "#fff", fontWeight: "600" },
});

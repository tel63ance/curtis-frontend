// inventory_manager/dashboard.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
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

// Available categories for products
const PRODUCT_CATEGORIES = [
  "Plants",
  "Tools",
  "Fertilizers",
  "Pesticides",
  "Soil",
  "Seeds",
  "Equipment",
  "Accessories",
];

// Supply statuses and their colors
const SUPPLY_STATUSES = {
  pending: { color: "#f59e0b", label: "Pending", icon: "time-outline" },
  quoted: { color: "#8b5cf6", label: "Quoted", icon: "pricetag-outline" },
  approved: {
    color: "#10b981",
    label: "Approved",
    icon: "checkmark-circle-outline",
  },
  rejected: {
    color: "#ef4444",
    label: "Rejected",
    icon: "close-circle-outline",
  },
  shipped: { color: "#3b82f6", label: "Shipped", icon: "cube-outline" },
  delivered: {
    color: "#2d6a4f",
    label: "Delivered",
    icon: "checkmark-done-outline",
  },
  paid: { color: "#2E7D32", label: "Paid", icon: "cash-outline" },
};

// ============== INVENTORY ITEM COMPONENT ==============
const InventoryItem = ({
  item,
  formatCurrency,
  getStatusColor,
  getStatusIcon,
  onManagePress,
}) => {
  const isLowStock = item.status === "Low Stock";
  const isOutOfStock = item.status === "Out of Stock";

  return (
    <TouchableOpacity
      style={[styles.inventoryCard, isLowStock && styles.lowStockCard]}
      onPress={() => onManagePress(item)}
    >
      <View style={styles.inventoryHeader}>
        <View style={styles.inventoryIdContainer}>
          <Ionicons name="pricetag-outline" size={14} color="#2E7D32" />
          <Text style={styles.inventoryId}>ID: {item.id}</Text>
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
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.inventoryInfo}>
        <Text style={styles.inventoryName}>{item.item_name}</Text>

        <View style={styles.inventoryRow}>
          <Text style={styles.inventoryLabel}>Category:</Text>
          <Text style={styles.inventoryValue}>{item.category}</Text>
        </View>

        <View style={styles.inventoryRow}>
          <Text style={styles.inventoryLabel}>Quantity:</Text>
          <Text
            style={[
              styles.inventoryValue,
              isLowStock && styles.lowStockText,
              isOutOfStock && styles.outOfStockText,
            ]}
          >
            {item.quantity} {item.unit}
          </Text>
        </View>

        <View style={styles.inventoryRow}>
          <Text style={styles.inventoryLabel}>Unit Price:</Text>
          <Text style={[styles.inventoryValue, styles.unitPrice]}>
            {formatCurrency(item.unit_price)}
          </Text>
        </View>

        <View style={styles.inventoryRow}>
          <Text style={styles.inventoryLabel}>Supplier:</Text>
          <Text style={styles.inventoryValue}>
            {item.supplier_name || "Not specified"}
          </Text>
        </View>

        {item.min_stock > 0 && (
          <View style={styles.inventoryRow}>
            <Text style={styles.inventoryLabel}>Min Stock:</Text>
            <Text style={styles.inventoryValue}>
              {item.min_stock} {item.unit}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.inventoryActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.manageButton]}
          onPress={() => onManagePress(item)}
        >
          <Ionicons name="settings-outline" size={14} color="white" />
          <Text style={styles.actionButtonText}>Manage</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ============== SUPPLY ITEM COMPONENT ==============
const SupplyItem = ({
  item,
  formatCurrency,
  formatDate,
  onApprovePress,
  onRejectPress,
  onDeliverPress,
}) => {
  const status = item.status || "pending";
  const statusConfig = SUPPLY_STATUSES[status] || SUPPLY_STATUSES.pending;

  return (
    <View style={styles.supplyCard}>
      <View style={styles.supplyHeader}>
        <View style={styles.supplyIdContainer}>
          <Ionicons name="document-text-outline" size={16} color="#2E7D32" />
          <Text style={styles.supplyId}>{item.id}</Text>
        </View>
        <View
          style={[
            styles.supplyStatusBadge,
            { backgroundColor: `${statusConfig.color}20` },
          ]}
        >
          <Ionicons
            name={statusConfig.icon}
            size={12}
            color={statusConfig.color}
          />
          <Text
            style={[styles.supplyStatusText, { color: statusConfig.color }]}
          >
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <Text style={styles.supplyItemName}>{item.item_name}</Text>

      <View style={styles.supplyDetails}>
        <View style={styles.supplyDetailRow}>
          <Ionicons name="person-outline" size={14} color="#64748b" />
          <Text style={styles.supplyDetailLabel}>Supplier:</Text>
          <Text style={styles.supplyDetailValue}>{item.supplier_name}</Text>
        </View>

        <View style={styles.supplyDetailRow}>
          <Ionicons name="cube-outline" size={14} color="#64748b" />
          <Text style={styles.supplyDetailLabel}>Quantity:</Text>
          <Text style={styles.supplyDetailValue}>
            {item.quantity} {item.unit}
          </Text>
        </View>

        <View style={styles.supplyDetailRow}>
          <Ionicons name="cash-outline" size={14} color="#64748b" />
          <Text style={styles.supplyDetailLabel}>Total:</Text>
          <Text style={[styles.supplyDetailValue, styles.supplyPrice]}>
            {formatCurrency(
              item.total_price || item.quantity * item.unit_price,
            )}
          </Text>
        </View>

        {item.supplier_quote && (
          <View style={styles.supplyDetailRow}>
            <Ionicons name="pricetag-outline" size={14} color="#8b5cf6" />
            <Text style={styles.supplyDetailLabel}>Quote:</Text>
            <Text style={[styles.supplyDetailValue, { color: "#8b5cf6" }]}>
              {formatCurrency(item.supplier_quote)}
            </Text>
          </View>
        )}

        <View style={styles.supplyDetailRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748b" />
          <Text style={styles.supplyDetailLabel}>Requested:</Text>
          <Text style={styles.supplyDetailValue}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        {item.supply_date && (
          <View style={styles.supplyDetailRow}>
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <Text style={styles.supplyDetailLabel}>Supply Date:</Text>
            <Text style={styles.supplyDetailValue}>
              {formatDate(item.supply_date)}
            </Text>
          </View>
        )}

        {item.notes && (
          <View style={styles.supplyNotes}>
            <Ionicons name="document-text-outline" size={14} color="#64748b" />
            <Text style={styles.supplyNotesText}>{item.notes}</Text>
          </View>
        )}
      </View>

      {/* Action buttons based on status */}
      <View style={styles.supplyActions}>
        {item.status === "quoted" && (
          <View style={styles.supplyActionRow}>
            <TouchableOpacity
              style={[styles.supplyActionButton, styles.approveButton]}
              onPress={() => onApprovePress(item)}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="white"
              />
              <Text style={styles.supplyActionText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.supplyActionButton, styles.rejectButton]}
              onPress={() => onRejectPress(item)}
            >
              <Ionicons name="close-circle-outline" size={16} color="white" />
              <Text style={styles.supplyActionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === "shipped" && (
          <TouchableOpacity
            style={[styles.supplyActionButton, styles.deliverButton]}
            onPress={() => onDeliverPress(item)}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="white" />
            <Text style={styles.supplyActionText}>Mark Delivered</Text>
          </TouchableOpacity>
        )}

        {item.status === "approved" && (
          <View style={styles.supplyActionButtonDisabled}>
            <Ionicons name="time-outline" size={16} color="#64748b" />
            <Text style={styles.supplyActionTextDisabled}>
              Awaiting Shipment
            </Text>
          </View>
        )}

        {item.status === "delivered" && (
          <View
            style={[styles.supplyActionButton, { backgroundColor: "#2E7D32" }]}
          >
            <Ionicons name="checkmark-circle" size={16} color="white" />
            <Text style={styles.supplyActionText}>Delivered</Text>
          </View>
        )}

        {item.status === "rejected" && (
          <View
            style={[
              styles.supplyActionButtonDisabled,
              { backgroundColor: "#fee2e2" },
            ]}
          >
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <Text
              style={[styles.supplyActionTextDisabled, { color: "#ef4444" }]}
            >
              Rejected
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default function InventoryDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [managerId, setManagerId] = useState(null);

  // Inventory state
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Supplies state (requests)
  const [supplies, setSupplies] = useState([]);
  const [filteredSupplies, setFilteredSupplies] = useState([]);
  const [supplySearchQuery, setSupplySearchQuery] = useState("");
  const [selectedSupplyStatus, setSelectedSupplyStatus] = useState("all");
  const [showSuppliesModal, setShowSuppliesModal] = useState(false);

  // Modal states
  const [manageModal, setManageModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);
  const [updateStockModal, setUpdateStockModal] = useState(false);
  const [requestNewItemModal, setRequestNewItemModal] = useState(false);

  // Selected item for actions
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Form states
  const [orderQuantity, setOrderQuantity] = useState("");
  const [updateQuantity, setUpdateQuantity] = useState("");
  const [updateType, setUpdateType] = useState("add");

  // New item request form
  const [newItemRequest, setNewItemRequest] = useState({
    item_name: "",
    category: "Plants",
    quantity: "",
    unit: "pcs",
    unit_price: "",
    supplier_id: "",
    supply_date: new Date().toISOString().split("T")[0],
    notes: "",
    min_stock: "",
  });

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
    pendingSupplies: 0,
    quotedSupplies: 0,
    shippedSupplies: 0,
    deliveredSupplies: 0,
  });

  const categories = ["All", ...PRODUCT_CATEGORIES];
  const units = ["pcs", "kg", "g", "L", "ml", "bags", "boxes", "bundles"];

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (managerId) {
      fetchInventory();
      fetchSuppliers();
      fetchSupplies();
    }
  }, [managerId]);

  useEffect(() => {
    let filtered = inventory;

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.item_name.toLowerCase().includes(query) ||
          (item.supplier_name &&
            item.supplier_name.toLowerCase().includes(query)) ||
          item.category.toLowerCase().includes(query),
      );
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    setFilteredInventory(filtered);
  }, [inventory, searchQuery, selectedCategory]);

  useEffect(() => {
    let filtered = supplies;

    if (supplySearchQuery.trim() !== "") {
      const query = supplySearchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.item_name.toLowerCase().includes(query) ||
          (item.supplier_name &&
            item.supplier_name.toLowerCase().includes(query)) ||
          item.id.toLowerCase().includes(query),
      );
    }

    if (selectedSupplyStatus !== "all") {
      filtered = filtered.filter(
        (item) => item.status === selectedSupplyStatus,
      );
    }

    setFilteredSupplies(filtered);
  }, [supplies, supplySearchQuery, selectedSupplyStatus]);

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
      setManagerId(id);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load page");
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

  const fetchInventory = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

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
      const inventoryData = Array.isArray(data) ? data : [];

      setInventory(inventoryData);

      // Calculate stats
      const totalValue = inventoryData.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
        0,
      );
      const lowStock = inventoryData.filter(
        (item) => item?.status === "Low Stock",
      ).length;
      const outOfStock = inventoryData.filter(
        (item) => item?.status === "Out of Stock",
      ).length;

      setStats((prev) => ({
        ...prev,
        totalItems: inventoryData.length,
        totalValue,
        lowStock,
        outOfStock,
      }));
    } catch (error) {
      console.error("❌ Error fetching inventory:", error);
      Alert.alert("Error", "Failed to fetch inventory");
    }
  };

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      // Try multiple possible endpoints
      let response;
      let data;
      let success = false;

      // Try endpoint with /api prefix first
      try {
        response = await fetch(`${BASE_URL}/api/admin/users?role=supplier`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          data = await response.json();
          success = true;
        }
      } catch (err) {
        console.log("First endpoint failed:", err.message);
      }

      if (!success) {
        try {
          response = await fetch(`${BASE_URL}/api/users?role=supplier`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            data = await response.json();
            success = true;
          }
        } catch (err) {
          console.log("Second endpoint failed:", err.message);
        }
      }

      if (success) {
        let suppliersArray = [];

        if (Array.isArray(data)) {
          suppliersArray = data;
        } else if (data && typeof data === "object") {
          if (data.users && Array.isArray(data.users)) {
            suppliersArray = data.users;
          } else if (data.data && Array.isArray(data.data)) {
            suppliersArray = data.data;
          } else if (data.suppliers && Array.isArray(data.suppliers)) {
            suppliersArray = data.suppliers;
          }
        }

        setSuppliers(suppliersArray);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error("❌ Error fetching suppliers:", error);
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchSupplies = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${BASE_URL}/api/supplies`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const suppliesData = Array.isArray(data) ? data : [];
        setSupplies(suppliesData);
        setFilteredSupplies(suppliesData);

        // Calculate supply stats
        const pendingCount = suppliesData.filter(
          (s) => s.status === "pending",
        ).length;
        const quotedCount = suppliesData.filter(
          (s) => s.status === "quoted",
        ).length;
        const shippedCount = suppliesData.filter(
          (s) => s.status === "shipped",
        ).length;
        const deliveredCount = suppliesData.filter(
          (s) => s.status === "delivered",
        ).length;

        setStats((prev) => ({
          ...prev,
          pendingSupplies: pendingCount,
          quotedSupplies: quotedCount,
          shippedSupplies: shippedCount,
          deliveredSupplies: deliveredCount,
        }));
      } else {
        setSupplies([]);
        setFilteredSupplies([]);
      }
    } catch (error) {
      console.error("❌ Error fetching supplies:", error);
    }
  };

  const handleApproveQuote = async (supply) => {
    Alert.alert(
      "Approve Quote",
      `Are you sure you want to approve the quote for ${supply.item_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(
                `${BASE_URL}/api/supplies/${supply.id}/approve`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ approve: true }),
                },
              );

              if (response.ok) {
                Alert.alert("Success", "Quote approved successfully");
                await fetchSupplies();
              } else {
                const error = await response.json();
                throw new Error(error.error || "Failed to approve quote");
              }
            } catch (error) {
              console.error("Error approving quote:", error);
              Alert.alert("Error", error.message || "Failed to approve quote");
            }
          },
        },
      ],
    );
  };

  const handleRejectQuote = async (supply) => {
    Alert.alert(
      "Reject Quote",
      `Are you sure you want to reject the quote for ${supply.item_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(
                `${BASE_URL}/api/supplies/${supply.id}/approve`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ approve: false }),
                },
              );

              if (response.ok) {
                Alert.alert("Success", "Quote rejected");
                await fetchSupplies();
              } else {
                const error = await response.json();
                throw new Error(error.error || "Failed to reject quote");
              }
            } catch (error) {
              console.error("Error rejecting quote:", error);
              Alert.alert("Error", error.message || "Failed to reject quote");
            }
          },
        },
      ],
    );
  };

  const handleMarkAsDelivered = async (supply) => {
    Alert.alert(
      "Confirm Delivery",
      `Are you sure you want to mark supply ${supply.id} as delivered?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Deliver",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(
                `${BASE_URL}/api/supplies/${supply.id}/deliver`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                },
              );

              if (response.ok) {
                Alert.alert("Success", "Supply marked as delivered");
                await Promise.all([fetchSupplies(), fetchInventory()]);
              } else {
                const error = await response.json();
                throw new Error(error.error || "Failed to mark as delivered");
              }
            } catch (error) {
              console.error("Error marking as delivered:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to mark as delivered",
              );
            }
          },
        },
      ],
    );
  };

  const handleRequestNewItemPress = () => {
    setNewItemRequest({
      item_name: "",
      category: "Plants",
      quantity: "",
      unit: "pcs",
      unit_price: "",
      supplier_id: "",
      supply_date: new Date().toISOString().split("T")[0],
      notes: "",
      min_stock: "",
    });
    setSelectedSupplier(null);
    setRequestNewItemModal(true);
  };

  const handleCreateSupplyRequest = async () => {
    if (!newItemRequest.item_name.trim()) {
      Alert.alert("Error", "Please enter item name");
      return;
    }
    if (!newItemRequest.quantity || parseInt(newItemRequest.quantity) <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }
    if (
      !newItemRequest.unit_price ||
      parseFloat(newItemRequest.unit_price) <= 0
    ) {
      Alert.alert("Error", "Please enter a valid unit price");
      return;
    }
    if (!newItemRequest.supplier_id) {
      Alert.alert("Error", "Please select a supplier");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const supplyData = {
        supplier_id: newItemRequest.supplier_id,
        item_name: newItemRequest.item_name,
        category: newItemRequest.category,
        unit: newItemRequest.unit,
        quantity: parseInt(newItemRequest.quantity),
        unit_price: parseFloat(newItemRequest.unit_price),
        supply_date: newItemRequest.supply_date,
        notes: newItemRequest.notes,
        min_stock: parseInt(newItemRequest.min_stock) || 0,
      };

      const response = await fetch(`${BASE_URL}/api/supplies`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(supplyData),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          "Success",
          `Supply request created successfully with ID: ${result.supply_id}`,
        );
        setRequestNewItemModal(false);
        await fetchSupplies();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create supply request");
      }
    } catch (error) {
      console.error("Error creating supply:", error);
      Alert.alert("Error", error.message || "Failed to create supply request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManageItem = (item) => {
    setSelectedItem(item);
    setManageModal(true);
  };

  const handleUpdateStockPress = () => {
    setManageModal(false);
    setUpdateQuantity("");
    setUpdateType("add");
    setUpdateStockModal(true);
  };

  const handleUpdateStock = async () => {
    if (!updateQuantity || parseInt(updateQuantity) <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    const quantity = parseInt(updateQuantity);
    const currentQuantity = selectedItem.quantity || 0;
    let newQuantity;

    if (updateType === "add") {
      newQuantity = currentQuantity + quantity;
    } else {
      if (quantity > currentQuantity) {
        Alert.alert("Error", "Cannot remove more than current stock");
        return;
      }
      newQuantity = currentQuantity - quantity;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${BASE_URL}/api/inventory/${selectedItem.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            updated_by: managerId,
            quantity: newQuantity,
          }),
        },
      );

      if (response.ok) {
        Alert.alert("Success", "Stock updated successfully");
        setUpdateStockModal(false);
        await fetchInventory();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update stock");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOrderPress = () => {
    setManageModal(false);
    setOrderQuantity("");
    setSelectedSupplier(null);
    setOrderModal(true);
  };

  const placeOrder = async () => {
    if (!selectedSupplier) {
      Alert.alert("Error", "Please select a supplier");
      return;
    }

    if (!orderQuantity || parseInt(orderQuantity) <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const supplyData = {
        supplier_id: selectedSupplier.id,
        item_name: selectedItem.item_name,
        category: selectedItem.category,
        unit: selectedItem.unit,
        quantity: parseInt(orderQuantity),
        unit_price: selectedItem.unit_price,
        supply_date: new Date().toISOString().split("T")[0],
        notes: `Reorder of ${selectedItem.item_name}`,
        min_stock: selectedItem.min_stock || 0,
      };

      const response = await fetch(`${BASE_URL}/api/supplies`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(supplyData),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          "Success",
          `Reorder placed successfully. Supply ID: ${result.supply_id}`,
          [
            {
              text: "OK",
              onPress: () => {
                setOrderModal(false);
                setSelectedSupplier(null);
                setOrderQuantity("");
                fetchSupplies();
              },
            },
          ],
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to place reorder");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to place reorder");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = () => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete ${selectedItem.item_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(
                `${BASE_URL}/api/inventory/${selectedItem.id}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );

              if (response.ok) {
                await fetchInventory();
                setManageModal(false);
                Alert.alert("Success", "Item deleted successfully");
              } else {
                throw new Error("Delete failed");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete item");
            }
          },
        },
      ],
    );
  };

  const handleViewSupplies = () => {
    setSupplySearchQuery("");
    setSelectedSupplyStatus("all");
    setShowSuppliesModal(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchInventory(), fetchSuppliers(), fetchSupplies()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    if (!amount) return "KSh 0.00";
    return `KSh ${parseFloat(amount).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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

  const getStatusColor = (status) => {
    switch (status) {
      case "Out of Stock":
        return "#ef4444";
      case "Low Stock":
        return "#f59e0b";
      case "Available":
        return "#10b981";
      default:
        return "#64748b";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Out of Stock":
        return "close-circle-outline";
      case "Low Stock":
        return "warning-outline";
      case "Available":
        return "checkmark-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const renderInventoryItem = ({ item }) => (
    <InventoryItem
      item={item}
      formatCurrency={formatCurrency}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      onManagePress={handleManageItem}
    />
  );

  const renderSupplyItem = ({ item }) => (
    <SupplyItem
      item={item}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
      onApprovePress={handleApproveQuote}
      onRejectPress={handleRejectQuote}
      onDeliverPress={handleMarkAsDelivered}
    />
  );

  const renderSupplierOption = (supplier) => (
    <TouchableOpacity
      key={supplier.id}
      style={[
        styles.supplierOption,
        selectedSupplier?.id === supplier.id && styles.selectedSupplier,
      ]}
      onPress={() => {
        setSelectedSupplier(supplier);
        if (requestNewItemModal) {
          setNewItemRequest({ ...newItemRequest, supplier_id: supplier.id });
        }
      }}
    >
      <Text
        style={[
          styles.supplierOptionText,
          selectedSupplier?.id === supplier.id && styles.selectedSupplierText,
        ]}
      >
        {supplier.name}
      </Text>
      {supplier.email && (
        <Text style={styles.supplierContact}>{supplier.email}</Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyInventory = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>No Inventory Items</Text>
      <Text style={styles.emptyText}>
        {searchQuery || selectedCategory !== "All"
          ? "No items match your search"
          : "Request new items from suppliers"}
      </Text>
      {(searchQuery || selectedCategory !== "All") && (
        <TouchableOpacity
          style={styles.clearFiltersButton}
          onPress={() => {
            setSearchQuery("");
            setSelectedCategory("All");
          }}
        >
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmptySuppliers = () => (
    <View style={styles.emptySuppliersContainer}>
      <Ionicons name="people-outline" size={32} color="#cbd5e1" />
      <Text style={styles.emptySuppliersText}>No suppliers available</Text>
      <Text style={styles.emptySuppliersSubtext}>
        Please contact admin to add suppliers
      </Text>
    </View>
  );

  const renderEmptySupplies = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>No Supply Requests</Text>
      <Text style={styles.emptyText}>
        {supplySearchQuery || selectedSupplyStatus !== "all"
          ? "No requests match your filters"
          : "Request new items using the 'Request New Item' button"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftPlaceholder} />
        <Text style={styles.title}>Inventory Manager</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleViewSupplies}
          >
            <Ionicons name="document-text-outline" size={24} color="#2E7D32" />
            {(stats.pendingSupplies > 0 ||
              stats.quotedSupplies > 0 ||
              stats.shippedSupplies > 0) && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {stats.pendingSupplies +
                    stats.quotedSupplies +
                    stats.shippedSupplies}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRequestNewItemPress}
          >
            <Ionicons name="add-circle" size={28} color="#2E7D32" />
          </TouchableOpacity>
        </View>
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
              {userData?.name || "Inventory Manager"}
            </Text>
          </View>
          <View style={styles.rolePill}>
            <Ionicons name="cube-outline" size={16} color="#2E7D32" />
            <Text style={styles.roleText}>Manager</Text>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Inventory Overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: "#2E7D32" }]}>
                <Text style={styles.statNumber}>{stats.totalItems}</Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#81C784" }]}>
                <Text style={styles.statNumber}>
                  KSh {(stats.totalValue / 1000).toFixed(1)}K
                </Text>
                <Text style={styles.statLabel}>Total Value</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#f59e0b" }]}>
                <Text style={styles.statNumber}>{stats.lowStock}</Text>
                <Text style={styles.statLabel}>Low Stock</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#ef4444" }]}>
                <Text style={styles.statNumber}>{stats.outOfStock}</Text>
                <Text style={styles.statLabel}>Out of Stock</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#f59e0b" }]}>
                <Text style={styles.statNumber}>{stats.pendingSupplies}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#8b5cf6" }]}>
                <Text style={styles.statNumber}>{stats.quotedSupplies}</Text>
                <Text style={styles.statLabel}>Quoted</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#3b82f6" }]}>
                <Text style={styles.statNumber}>{stats.shippedSupplies}</Text>
                <Text style={styles.statLabel}>Shipped</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#2E7D32" }]}>
                <Text style={styles.statNumber}>{stats.deliveredSupplies}</Text>
                <Text style={styles.statLabel}>Delivered</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Inventory Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory Items</Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items or suppliers..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.selectedCategoryChip,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category &&
                      styles.selectedCategoryChipText,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Inventory List */}
          <FlatList
            data={filteredInventory}
            renderItem={renderInventoryItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.inventoryList}
            ListEmptyComponent={renderEmptyInventory}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Nairobi Botanica Inventory</Text>
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>
      </ScrollView>

      {/* ============== MANAGE ITEM MODAL ============== */}
      <Modal
        visible={manageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setManageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Item</Text>
              <TouchableOpacity onPress={() => setManageModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <ScrollView style={styles.modalContent}>
                <View
                  style={[
                    styles.modalStatusBar,
                    {
                      backgroundColor: `${getStatusColor(selectedItem.status)}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(selectedItem.status)}
                    size={20}
                    color={getStatusColor(selectedItem.status)}
                  />
                  <Text
                    style={[
                      styles.modalStatusText,
                      { color: getStatusColor(selectedItem.status) },
                    ]}
                  >
                    {selectedItem.status}
                  </Text>
                </View>

                <View style={styles.modalItemInfo}>
                  <Text style={styles.modalItemName}>
                    {selectedItem.item_name}
                  </Text>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Category:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedItem.category}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Current Stock:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedItem.quantity} {selectedItem.unit}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Unit Price:</Text>
                    <Text style={[styles.modalInfoValue, styles.modalPrice]}>
                      {formatCurrency(selectedItem.unit_price)}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Min Stock:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedItem.min_stock || 0} {selectedItem.unit}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Supplier:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedItem.supplier_name || "Not specified"}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActionsGrid}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.updateButton]}
                    onPress={handleUpdateStockPress}
                  >
                    <Ionicons name="refresh-outline" size={20} color="white" />
                    <Text style={styles.modalActionText}>Update Stock</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.orderActionButton]}
                    onPress={handleOrderPress}
                  >
                    <Ionicons name="cart-outline" size={20} color="white" />
                    <Text style={styles.modalActionText}>Reorder</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.deleteButton]}
                    onPress={handleDeleteItem}
                  >
                    <Ionicons name="trash-outline" size={20} color="white" />
                    <Text style={styles.modalActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============== UPDATE STOCK MODAL ============== */}
      <Modal
        visible={updateStockModal}
        transparent
        animationType="slide"
        onRequestClose={() => setUpdateStockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Stock</Text>
              <TouchableOpacity onPress={() => setUpdateStockModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <ScrollView style={styles.modalContent}>
                <Text style={styles.modalItemName}>
                  {selectedItem.item_name}
                </Text>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Current Stock:</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedItem.quantity} {selectedItem.unit}
                  </Text>
                </View>

                <View style={styles.updateTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.updateTypeButton,
                      updateType === "add" && styles.updateTypeActive,
                    ]}
                    onPress={() => setUpdateType("add")}
                  >
                    <Ionicons
                      name="add-circle"
                      size={20}
                      color={updateType === "add" ? "white" : "#2E7D32"}
                    />
                    <Text
                      style={[
                        styles.updateTypeText,
                        updateType === "add" && styles.updateTypeTextActive,
                      ]}
                    >
                      Add Stock
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.updateTypeButton,
                      updateType === "remove" && styles.updateTypeActive,
                    ]}
                    onPress={() => setUpdateType("remove")}
                  >
                    <Ionicons
                      name="remove-circle"
                      size={20}
                      color={updateType === "remove" ? "white" : "#ef4444"}
                    />
                    <Text
                      style={[
                        styles.updateTypeText,
                        updateType === "remove" && styles.updateTypeTextActive,
                      ]}
                    >
                      Remove Stock
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>Quantity to {updateType}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`Enter quantity to ${updateType}`}
                  keyboardType="numeric"
                  value={updateQuantity}
                  onChangeText={setUpdateQuantity}
                />

                {updateQuantity && (
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryTitle}>Update Summary</Text>
                    <View style={styles.summaryRow}>
                      <Text>New Stock Level:</Text>
                      <Text style={styles.summaryValue}>
                        {updateType === "add"
                          ? selectedItem.quantity +
                            parseInt(updateQuantity || 0)
                          : selectedItem.quantity -
                            parseInt(updateQuantity || 0)}{" "}
                        {selectedItem.unit}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setUpdateStockModal(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.submitButton,
                      (!updateQuantity || submitting) && styles.buttonDisabled,
                    ]}
                    onPress={handleUpdateStock}
                    disabled={!updateQuantity || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.submitButtonText}>Update Stock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============== REORDER MODAL ============== */}
      <Modal
        visible={orderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reorder Item</Text>
              <TouchableOpacity onPress={() => setOrderModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <ScrollView style={styles.modalContent}>
                <Text style={styles.modalItemName}>
                  {selectedItem.item_name}
                </Text>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Current Stock:</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedItem.quantity} {selectedItem.unit}
                  </Text>
                </View>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Unit Price:</Text>
                  <Text style={[styles.modalInfoValue, styles.modalPrice]}>
                    {formatCurrency(selectedItem.unit_price)}
                  </Text>
                </View>

                <Text style={styles.modalLabel}>Quantity to Order</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter quantity"
                  keyboardType="numeric"
                  value={orderQuantity}
                  onChangeText={setOrderQuantity}
                />

                <Text style={styles.modalLabel}>Select Supplier</Text>
                <View style={styles.modalPicker}>
                  {loadingSuppliers ? (
                    <ActivityIndicator
                      size="small"
                      color="#2E7D32"
                      style={styles.pickerLoader}
                    />
                  ) : suppliers.length > 0 ? (
                    suppliers.map(renderSupplierOption)
                  ) : (
                    renderEmptySuppliers()
                  )}
                </View>

                {orderQuantity && selectedSupplier && (
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryTitle}>Order Summary</Text>
                    <View style={styles.summaryRow}>
                      <Text>Total Amount:</Text>
                      <Text style={styles.summaryValue}>
                        {formatCurrency(
                          parseInt(orderQuantity) * selectedItem.unit_price,
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setOrderModal(false);
                      setSelectedSupplier(null);
                      setOrderQuantity("");
                    }}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.submitButton,
                      (!selectedSupplier || !orderQuantity || submitting) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={placeOrder}
                    disabled={!selectedSupplier || !orderQuantity || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.submitButtonText}>Place Reorder</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============== FULL SCREEN REQUEST NEW ITEM MODAL ============== */}
      <Modal
        visible={requestNewItemModal}
        animationType="slide"
        onRequestClose={() => setRequestNewItemModal(false)}
      >
        <SafeAreaView style={styles.fullScreenModal}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => setRequestNewItemModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#2E7D32" />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>Request New Item</Text>
            <View style={styles.fullScreenHeaderRight} />
          </View>

          <ScrollView
            style={styles.fullScreenContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalSectionTitle}>Item Details</Text>

            <Text style={styles.modalLabel}>Item Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter item name"
              value={newItemRequest.item_name}
              onChangeText={(text) =>
                setNewItemRequest({ ...newItemRequest, item_name: text })
              }
            />

            <Text style={styles.modalLabel}>Category *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryPicker}
            >
              {PRODUCT_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    newItemRequest.category === category &&
                      styles.selectedCategoryChip,
                  ]}
                  onPress={() =>
                    setNewItemRequest({ ...newItemRequest, category })
                  }
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      newItemRequest.category === category &&
                        styles.selectedCategoryChipText,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.modalLabel}>Quantity *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={newItemRequest.quantity}
                  onChangeText={(text) =>
                    setNewItemRequest({ ...newItemRequest, quantity: text })
                  }
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.modalLabel}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {units.map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitChip,
                        newItemRequest.unit === unit && styles.selectedUnitChip,
                      ]}
                      onPress={() =>
                        setNewItemRequest({ ...newItemRequest, unit })
                      }
                    >
                      <Text
                        style={[
                          styles.unitChipText,
                          newItemRequest.unit === unit &&
                            styles.selectedUnitChipText,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={styles.modalLabel}>Unit Price (KSh) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              keyboardType="numeric"
              value={newItemRequest.unit_price}
              onChangeText={(text) =>
                setNewItemRequest({ ...newItemRequest, unit_price: text })
              }
            />

            <Text style={styles.modalLabel}>Minimum Stock Level</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              keyboardType="numeric"
              value={newItemRequest.min_stock}
              onChangeText={(text) =>
                setNewItemRequest({ ...newItemRequest, min_stock: text })
              }
            />

            <Text style={styles.modalLabel}>Supply Date</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.datePickerText}>
                {newItemRequest.supply_date || "Select date"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={new Date(newItemRequest.supply_date || new Date())}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setNewItemRequest({
                      ...newItemRequest,
                      supply_date: selectedDate.toISOString().split("T")[0],
                    });
                  }
                }}
              />
            )}

            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              placeholder="Additional notes (optional)"
              multiline
              numberOfLines={3}
              value={newItemRequest.notes}
              onChangeText={(text) =>
                setNewItemRequest({ ...newItemRequest, notes: text })
              }
            />

            <Text style={styles.modalLabel}>Select Supplier *</Text>
            <View style={styles.supplierListContainer}>
              {loadingSuppliers ? (
                <ActivityIndicator
                  size="small"
                  color="#2E7D32"
                  style={styles.pickerLoader}
                />
              ) : suppliers.length > 0 ? (
                suppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[
                      styles.supplierOption,
                      selectedSupplier?.id === supplier.id &&
                        styles.selectedSupplier,
                    ]}
                    onPress={() => {
                      setSelectedSupplier(supplier);
                      setNewItemRequest({
                        ...newItemRequest,
                        supplier_id: supplier.id,
                      });
                    }}
                  >
                    <Text
                      style={[
                        styles.supplierOptionText,
                        selectedSupplier?.id === supplier.id &&
                          styles.selectedSupplierText,
                      ]}
                    >
                      {supplier.name}
                    </Text>
                    {supplier.email && (
                      <Text style={styles.supplierContact}>
                        {supplier.email}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                renderEmptySuppliers()
              )}
            </View>

            <View style={styles.fullScreenActions}>
              <TouchableOpacity
                style={[styles.fullScreenButton, styles.cancelFullButton]}
                onPress={() => setRequestNewItemModal(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelFullButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.fullScreenButton,
                  styles.submitFullButton,
                  (!newItemRequest.item_name ||
                    !newItemRequest.quantity ||
                    !newItemRequest.unit_price ||
                    !newItemRequest.supplier_id ||
                    submitting) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleCreateSupplyRequest}
                disabled={
                  !newItemRequest.item_name ||
                  !newItemRequest.quantity ||
                  !newItemRequest.unit_price ||
                  !newItemRequest.supplier_id ||
                  submitting
                }
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.submitFullButtonText}>
                    Submit Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ============== FULL SCREEN SUPPLIES MODAL ============== */}
      <Modal
        visible={showSuppliesModal}
        animationType="slide"
        onRequestClose={() => setShowSuppliesModal(false)}
      >
        <SafeAreaView style={styles.fullScreenModal}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => setShowSuppliesModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#2E7D32" />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>Supply Requests</Text>
            <View style={styles.fullScreenHeaderRight} />
          </View>

          <View style={styles.fullScreenContent}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search supplies..."
                placeholderTextColor="#94a3b8"
                value={supplySearchQuery}
                onChangeText={setSupplySearchQuery}
              />
              {supplySearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSupplySearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedSupplyStatus === "all" && styles.selectedFilterChip,
                ]}
                onPress={() => setSelectedSupplyStatus("all")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedSupplyStatus === "all" &&
                      styles.selectedFilterChipText,
                  ]}
                >
                  All ({supplies.length})
                </Text>
              </TouchableOpacity>
              {Object.entries(SUPPLY_STATUSES).map(
                ([key, { color, label }]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.filterChip,
                      { borderColor: color },
                      selectedSupplyStatus === key && {
                        backgroundColor: color,
                      },
                    ]}
                    onPress={() => setSelectedSupplyStatus(key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedSupplyStatus === key && { color: "white" },
                      ]}
                    >
                      {label} ({supplies.filter((s) => s.status === key).length}
                      )
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>

            {/* Supplies List */}
            <FlatList
              data={filteredSupplies}
              renderItem={renderSupplyItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.suppliesListFull}
              ListEmptyComponent={renderEmptySupplies}
            />
          </View>
        </SafeAreaView>
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
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeftPlaceholder: {
    width: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerButton: {
    padding: 4,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
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
  statsContainer: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  statCard: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 90,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "white",
    opacity: 0.9,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
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
  categoryScroll: {
    flexDirection: "row",
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedCategoryChip: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  categoryChipText: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  selectedCategoryChipText: {
    color: "white",
  },
  inventoryList: {
    gap: 12,
  },
  inventoryCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  lowStockCard: {
    borderColor: "#f59e0b",
    borderWidth: 2,
    backgroundColor: "#fffaf0",
  },
  inventoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inventoryIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inventoryId: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
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
  inventoryInfo: {
    gap: 4,
    marginBottom: 8,
  },
  inventoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  inventoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inventoryLabel: {
    width: 80,
    fontSize: 12,
    color: "#64748b",
  },
  inventoryValue: {
    flex: 1,
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  unitPrice: {
    color: "#10b981",
    fontWeight: "600",
  },
  lowStockText: {
    color: "#f59e0b",
    fontWeight: "600",
  },
  outOfStockText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  inventoryActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  manageButton: {
    backgroundColor: "#2E7D32",
  },
  actionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
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
    marginBottom: 12,
  },
  clearFiltersButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearFiltersText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
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
  largeModal: {
    maxWidth: 500,
    maxHeight: "90%",
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
  modalStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalItemInfo: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  modalItemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalInfoLabel: {
    width: 100,
    fontSize: 13,
    color: "#64748b",
  },
  modalInfoValue: {
    flex: 1,
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
  },
  modalPrice: {
    color: "#10b981",
    fontWeight: "600",
  },
  modalActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalActionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  updateButton: {
    backgroundColor: "#f59e0b",
  },
  orderActionButton: {
    backgroundColor: "#0288D1",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
    marginTop: 16,
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
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalPicker: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 8,
    marginBottom: 12,
    maxHeight: 200,
  },
  pickerLoader: {
    padding: 20,
  },
  supplierOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  selectedSupplier: {
    backgroundColor: "#2E7D32",
  },
  supplierOptionText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  selectedSupplierText: {
    color: "white",
  },
  supplierContact: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  emptySuppliersContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptySuppliersText: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
  },
  emptySuppliersSubtext: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
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
  cancelButton: {
    backgroundColor: "#f1f5f9",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  submitButton: {
    backgroundColor: "#2E7D32",
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  updateTypeContainer: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 16,
  },
  updateTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
    gap: 8,
  },
  updateTypeActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  updateTypeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  updateTypeTextActive: {
    color: "white",
  },
  summaryBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  categoryPicker: {
    flexDirection: "row",
    marginBottom: 16,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedUnitChip: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  unitChipText: {
    fontSize: 11,
    color: "#1e293b",
    fontWeight: "500",
  },
  selectedUnitChipText: {
    color: "white",
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
    marginTop: 8,
  },
  datePickerButton: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  datePickerText: {
    fontSize: 14,
    color: "#1e293b",
  },
  // Supply Card Styles
  supplyCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  supplyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  supplyIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supplyId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  supplyStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  supplyStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  supplyItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  supplyDetails: {
    gap: 8,
    marginBottom: 12,
  },
  supplyDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supplyDetailLabel: {
    fontSize: 13,
    color: "#64748b",
    width: 80,
  },
  supplyDetailValue: {
    flex: 1,
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
  },
  supplyPrice: {
    color: "#10b981",
    fontWeight: "600",
  },
  supplyNotes: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
    gap: 8,
    marginTop: 4,
  },
  supplyNotesText: {
    flex: 1,
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
  },
  supplyActions: {
    marginTop: 8,
  },
  supplyActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  supplyActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: "#10b981",
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  deliverButton: {
    backgroundColor: "#2d6a4f",
  },
  supplyActionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  supplyActionButtonDisabled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    gap: 8,
  },
  supplyActionTextDisabled: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  // Full Screen Modal Styles
  fullScreenModal: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  fullScreenHeader: {
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
  fullScreenCloseButton: {
    padding: 4,
  },
  fullScreenTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  fullScreenHeaderRight: {
    width: 32,
  },
  fullScreenContent: {
    flex: 1,
    padding: 16,
  },
  filterScroll: {
    flexDirection: "row",
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
  },
  selectedFilterChip: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  filterChipText: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  selectedFilterChipText: {
    color: "white",
  },
  suppliesListFull: {
    paddingBottom: 20,
  },
  supplierListContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  fullScreenActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  fullScreenButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelFullButton: {
    backgroundColor: "#f1f5f9",
  },
  cancelFullButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  submitFullButton: {
    backgroundColor: "#2E7D32",
  },
  submitFullButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

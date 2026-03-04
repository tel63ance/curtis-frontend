// app/customer/profile.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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

// Main Profile Screen Component
export default function ProfileScreen() {
  const [currentScreen, setCurrentScreen] = useState("main");
  const [screenProps, setScreenProps] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case "messages":
        return (
          <MessagesScreen
            onBack={() => setCurrentScreen("main")}
            onSelectRole={(role) => {
              setSelectedRole(role);
              if (role.id === "engineer") {
                setCurrentScreen("engineer-list");
              } else {
                setCurrentScreen("messages-chat");
              }
            }}
          />
        );
      case "engineer-list":
        return (
          <EngineerListScreen
            onBack={() => setCurrentScreen("messages")}
            onSelectEngineer={(engineer) => {
              setSelectedEngineer(engineer);
              setCurrentScreen("messages-chat");
            }}
          />
        );
      case "messages-chat":
        return (
          <ChatScreen
            onBack={() => {
              if (selectedRole?.id === "engineer") {
                setCurrentScreen("engineer-list");
              } else {
                setCurrentScreen("messages");
              }
            }}
            role={selectedRole}
            engineer={selectedEngineer}
          />
        );
      case "bookings":
        return (
          <BookingsScreen
            onBack={() => setCurrentScreen("main")}
            {...screenProps}
          />
        );
      case "support":
        return (
          <SupportScreen
            onBack={() => setCurrentScreen("main")}
            {...screenProps}
          />
        );
      case "help":
        return (
          <HelpScreen
            onBack={() => setCurrentScreen("main")}
            {...screenProps}
          />
        );
      case "about":
        return (
          <AboutScreen
            onBack={() => setCurrentScreen("main")}
            {...screenProps}
          />
        );
      case "services":
        return (
          <ServicesScreen
            onBack={() => setCurrentScreen("main")}
            {...screenProps}
          />
        );
      default:
        return (
          <MainProfileScreen
            onNavigate={(screen, props = {}) => {
              setCurrentScreen(screen);
              setScreenProps(props);
            }}
          />
        );
    }
  };

  return renderScreen();
}

// Main Profile Screen
function MainProfileScreen({ onNavigate }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByRole, setUnreadByRole] = useState({
    service_manager: 0,
    engineer: 0,
    finance_manager: 0,
    inventory_manager: 0,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllUnreadCounts();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        setUser(userData);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadForRole = async (role) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !user) return 0;

      let url;
      if (role === "engineer") {
        // For engineer, we need to fetch all engineers and sum their unread counts
        const engineersResponse = await fetch(
          `${BASE_URL}/api/admin/users?role=engineer`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (engineersResponse.ok) {
          const engineersData = await engineersResponse.json();
          const engineersList = Array.isArray(engineersData)
            ? engineersData
            : engineersData.data || engineersData.users || [];

          let totalEngineerUnread = 0;

          // Fetch unread for each engineer
          const unreadPromises = engineersList.map(async (engineer) => {
            const engineerId = engineer.id || engineer.user_id;
            if (engineerId) {
              try {
                const inboxResponse = await fetch(
                  `${BASE_URL}/api/messages/inbox/engineer?recipientId=${engineerId}&customerId=${user.id}`,
                  { headers: { Authorization: `Bearer ${token}` } },
                );

                if (inboxResponse.ok) {
                  const inboxData = await inboxResponse.json();
                  return inboxData.unread || 0;
                }
              } catch (error) {
                console.error(
                  `Error fetching unread for engineer ${engineerId}:`,
                  error,
                );
              }
            }
            return 0;
          });

          const unreadCounts = await Promise.all(unreadPromises);
          totalEngineerUnread = unreadCounts.reduce(
            (sum, count) => sum + count,
            0,
          );
          return totalEngineerUnread;
        }
        return 0;
      } else {
        // For non-engineer roles, fetch inbox directly
        const response = await fetch(
          `${BASE_URL}/api/messages/inbox/${role}?customerId=${user.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const data = await response.json();
          return data.unread || 0;
        }
      }
      return 0;
    } catch (error) {
      console.error(`Error fetching unread for ${role}:`, error);
      return 0;
    }
  };

  const fetchAllUnreadCounts = async () => {
    try {
      const roles = [
        "service_manager",
        "engineer",
        "finance_manager",
        "inventory_manager",
      ];

      const unreadPromises = roles.map((role) => fetchUnreadForRole(role));
      const unreadCounts = await Promise.all(unreadPromises);

      const newUnreadByRole = {
        service_manager: unreadCounts[0],
        engineer: unreadCounts[1],
        finance_manager: unreadCounts[2],
        inventory_manager: unreadCounts[3],
      };

      setUnreadByRole(newUnreadByRole);

      // Calculate total unread count
      const total = unreadCounts.reduce((sum, count) => sum + count, 0);
      setUnreadCount(total);
    } catch (error) {
      console.error("Error fetching all unread counts:", error);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("user");
            router.replace("/login");
          } catch (error) {
            console.error("Error logging out:", error);
            Alert.alert("Error", "Failed to logout");
          }
        },
      },
    ]);
  };

  const menuItems = [
    {
      id: "bookings",
      title: "My Bookings",
      icon: "calendar-outline",
      color: "#2E7D32",
      onPress: () => onNavigate("bookings"),
    },
    {
      id: "messages",
      title: "Messages",
      icon: "chatbubble-outline",
      color: "#81C784",
      badge: unreadCount > 0 ? unreadCount : null,
      onPress: () => onNavigate("messages"),
    },
    {
      id: "services",
      title: "Our Services",
      icon: "leaf-outline",
      color: "#4CAF50",
      onPress: () => onNavigate("services"),
    },
    {
      id: "support",
      title: "Contact Support",
      icon: "headset-outline",
      color: "#FF9800",
      onPress: () => onNavigate("support"),
    },
    {
      id: "help",
      title: "Help & FAQ",
      icon: "help-circle-outline",
      color: "#9C27B0",
      onPress: () => onNavigate("help"),
    },
    {
      id: "about",
      title: "About Us",
      icon: "information-circle-outline",
      color: "#0288D1",
      onPress: () => onNavigate("about"),
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>profile</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="leaf" size={40} color="#2E7D32" />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || "Customer"}</Text>
          <Text style={styles.userEmail}>
            {user?.email || "customer@botanica.co.ke"}
          </Text>
          <Text style={styles.userId}>
            Customer ID: {user?.id?.slice(0, 8) || "N/A"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="person" size={20} color="#2E7D32" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>
                  {user?.name || "Not available"}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="mail" size={20} color="#2E7D32" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Email Address</Text>
                <Text style={styles.detailValue}>
                  {user?.email || "Not available"}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="call" size={20} color="#2E7D32" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>
                  {user?.phone || "+254 700 000 000"}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="location" size={20} color="#2E7D32" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {user?.location || "Karen, Nairobi"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View
                  style={[styles.menuIcon, { backgroundColor: item.color }]}
                >
                  <Ionicons name={item.icon} size={24} color="white" />
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Nairobi Botanica v1.0.0</Text>
          <Text style={styles.copyrightText}>
            © 2025 Nairobi Botanica Gardening Limited. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Bookings Screen
function BookingsScreen({ onBack }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUserAndBookings();
  }, []);

  const loadUserAndBookings = async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        setUser(userData);
        await fetchBookings(userData.id);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const fetchBookings = async (customerId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/api/bookings/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const customerBookings = data.filter(
          (booking) => booking.customer_id === customerId,
        );
        setBookings(customerBookings);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      Alert.alert("Error", "Failed to load bookings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (user) {
      fetchBookings(user.id);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filterStatus === "all") return true;
    return booking.status === filterStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      pending: "#FF9800",
      confirmed: "#2196F3",
      in_progress: "#4CAF50",
      completed: "#2E7D32",
      cancelled: "#F44336",
    };
    return colors[status] || "#9E9E9E";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount).toFixed(2)}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === "all" && styles.activeFilterTab,
            ]}
            onPress={() => setFilterStatus("all")}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === "all" && styles.activeFilterText,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === "pending" && styles.activeFilterTab,
            ]}
            onPress={() => setFilterStatus("pending")}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === "pending" && styles.activeFilterText,
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === "confirmed" && styles.activeFilterTab,
            ]}
            onPress={() => setFilterStatus("confirmed")}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === "confirmed" && styles.activeFilterText,
              ]}
            >
              Confirmed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === "in_progress" && styles.activeFilterTab,
            ]}
            onPress={() => setFilterStatus("in_progress")}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === "in_progress" && styles.activeFilterText,
              ]}
            >
              In Progress
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterStatus === "completed" && styles.activeFilterTab,
            ]}
            onPress={() => setFilterStatus("completed")}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === "completed" && styles.activeFilterText,
              ]}
            >
              Completed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.booking_id}
        contentContainerStyle={styles.bookingsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingId}>{item.booking_id}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) },
                ]}
              >
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <Text style={styles.serviceType}>{item.service_type}</Text>

            <View style={styles.bookingDetails}>
              <View style={styles.bookingRow}>
                <Ionicons name="calendar" size={16} color="#666" />
                <Text style={styles.bookingLabel}>Preferred Date:</Text>
                <Text style={styles.bookingValue}>
                  {formatDate(item.preferred_date)}
                </Text>
              </View>

              <View style={styles.bookingRow}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.bookingLabel}>Location:</Text>
                <Text style={styles.bookingValue}>{item.location}</Text>
              </View>

              <View style={styles.bookingRow}>
                <Ionicons name="cash" size={16} color="#666" />
                <Text style={styles.bookingLabel}>Fee:</Text>
                <Text style={styles.bookingValue}>
                  {formatCurrency(item.booking_fee)}
                </Text>
              </View>

              <View style={styles.bookingRow}>
                <Ionicons name="time" size={16} color="#666" />
                <Text style={styles.bookingLabel}>Booked:</Text>
                <Text style={styles.bookingValue}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
            </View>

            {item.description && (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionLabel}>Description:</Text>
                <Text style={styles.descriptionText}>{item.description}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Bookings Found</Text>
            <Text style={styles.emptyText}>
              {filterStatus === "all"
                ? "You haven't made any bookings yet"
                : `No ${filterStatus} bookings found`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Messages Screen - Select who to message
function MessagesScreen({ onBack, onSelectRole }) {
  const [user, setUser] = useState(null);
  const [unreadByRole, setUnreadByRole] = useState({});

  useEffect(() => {
    loadUserAndUnread();
  }, []);

  const loadUserAndUnread = async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        setUser(userData);

        // Fetch unread counts for each role
        const token = await AsyncStorage.getItem("token");
        const roles = [
          "service_manager",
          "engineer",
          "finance_manager",
          "inventory_manager",
        ];

        const unreadPromises = roles.map(async (role) => {
          if (role === "engineer") {
            // For engineers, fetch all engineers and sum unread
            try {
              const engineersResponse = await fetch(
                `${BASE_URL}/api/admin/users?role=engineer`,
                { headers: { Authorization: `Bearer ${token}` } },
              );

              if (engineersResponse.ok) {
                const engineersData = await engineersResponse.json();
                const engineersList = Array.isArray(engineersData)
                  ? engineersData
                  : engineersData.data || engineersData.users || [];

                let totalEngineerUnread = 0;

                const unreadPromises = engineersList.map(async (engineer) => {
                  const engineerId = engineer.id || engineer.user_id;
                  if (engineerId) {
                    try {
                      const inboxResponse = await fetch(
                        `${BASE_URL}/api/messages/inbox/engineer?recipientId=${engineerId}&customerId=${userData.id}`,
                        { headers: { Authorization: `Bearer ${token}` } },
                      );

                      if (inboxResponse.ok) {
                        const inboxData = await inboxResponse.json();
                        return inboxData.unread || 0;
                      }
                    } catch (error) {
                      console.error(
                        `Error fetching unread for engineer ${engineerId}:`,
                        error,
                      );
                    }
                  }
                  return 0;
                });

                const unreadCounts = await Promise.all(unreadPromises);
                totalEngineerUnread = unreadCounts.reduce(
                  (sum, count) => sum + count,
                  0,
                );
                return { role, count: totalEngineerUnread };
              }
            } catch (error) {
              console.error("Error fetching engineer unread:", error);
            }
            return { role, count: 0 };
          } else {
            try {
              const response = await fetch(
                `${BASE_URL}/api/messages/inbox/${role}?customerId=${userData.id}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (response.ok) {
                const data = await response.json();
                return { role, count: data.unread || 0 };
              }
            } catch (error) {
              console.error(`Error fetching unread for ${role}:`, error);
            }
            return { role, count: 0 };
          }
        });

        const results = await Promise.all(unreadPromises);
        const unreadMap = {};
        results.forEach(({ role, count }) => {
          unreadMap[role] = count;
        });
        setUnreadByRole(unreadMap);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const staffRoles = [
    {
      id: "service_manager",
      name: "Service Manager",
      icon: "people-outline",
      color: "#2E7D32",
      description: "Manage your service requests and bookings",
    },
    {
      id: "engineer",
      name: "Engineer",
      icon: "construct-outline",
      color: "#81C784",
      description: "Technical consultation and project execution",
    },
    {
      id: "finance_manager",
      name: "Finance Manager",
      icon: "cash-outline",
      color: "#FF9800",
      description: "Payments, invoices, and quotations",
    },
    {
      id: "inventory_manager",
      name: "Inventory Manager",
      icon: "cube-outline",
      color: "#9C27B0",
      description: "Material availability and supplies",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadUserAndUnread}
        >
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.screenContent}>
        <View style={styles.screenSection}>
          <Text style={styles.screenTitle}>Select Department:</Text>
          <Text style={styles.screenDescription}>
            Choose the team member you'd like to message about your landscaping
            project.
          </Text>

          <View style={styles.roleGrid}>
            {staffRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={styles.roleCard}
                onPress={() => onSelectRole(role)}
              >
                <View style={styles.roleIconContainer}>
                  <View
                    style={[styles.roleIcon, { backgroundColor: role.color }]}
                  >
                    <Ionicons name={role.icon} size={32} color="white" />
                  </View>
                  {unreadByRole[role.id] > 0 && (
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>
                        {unreadByRole[role.id]}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.roleName}>{role.name}</Text>
                <Text style={styles.roleDescription}>{role.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Engineer List Screen - Select a specific engineer
function EngineerListScreen({ onBack, onSelectEngineer }) {
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [engineerUnread, setEngineerUnread] = useState({});

  useEffect(() => {
    loadUserAndEngineers();
  }, []);

  const loadUserAndEngineers = async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        setUser(userData);
        await fetchEngineers(userData);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const fetchEngineers = async (userData) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(
        `${BASE_URL}/api/admin/users?role=engineer`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        let engineersList = [];

        if (Array.isArray(data)) {
          engineersList = data;
        } else if (data.data && Array.isArray(data.data)) {
          engineersList = data.data;
        } else if (data.users && Array.isArray(data.users)) {
          engineersList = data.users;
        }

        setEngineers(engineersList);

        // Fetch unread counts for each engineer
        const unreadPromises = engineersList.map(async (engineer) => {
          const engineerId = engineer.id || engineer.user_id;
          if (engineerId && userData) {
            try {
              const inboxResponse = await fetch(
                `${BASE_URL}/api/messages/inbox/engineer?recipientId=${engineerId}&customerId=${userData.id}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );

              if (inboxResponse.ok) {
                const inboxData = await inboxResponse.json();
                return { engineerId, unread: inboxData.unread || 0 };
              }
            } catch (error) {
              console.error(
                `Error fetching unread for engineer ${engineerId}:`,
                error,
              );
            }
          }
          return { engineerId, unread: 0 };
        });

        const unreadResults = await Promise.all(unreadPromises);
        const unreadMap = {};
        unreadResults.forEach(({ engineerId, unread }) => {
          unreadMap[engineerId] = unread;
        });
        setEngineerUnread(unreadMap);
      }
    } catch (error) {
      console.error("Error fetching engineers:", error);
      Alert.alert("Error", "Failed to load engineers list");
    } finally {
      setLoading(false);
    }
  };

  const filteredEngineers = engineers.filter((engineer) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      engineer.name?.toLowerCase().includes(searchLower) ||
      engineer.email?.toLowerCase().includes(searchLower) ||
      engineer.specialization?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Engineer</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadUserAndEngineers()}
        >
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search engineers by name or specialty..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading engineers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEngineers}
          keyExtractor={(item) =>
            item.id || item.user_id || Math.random().toString()
          }
          contentContainerStyle={styles.engineerList}
          renderItem={({ item }) => {
            const engineerId = item.id || item.user_id;
            const engineerName =
              item.name ||
              (item.first_name && item.last_name
                ? `${item.first_name} ${item.last_name}`
                : item.email || `Engineer ${engineerId?.slice(0, 8)}`);
            const unreadCount = engineerUnread[engineerId] || 0;
            const specialization =
              item.specialization || "Landscaping Specialist";

            return (
              <TouchableOpacity
                style={styles.engineerCard}
                onPress={() =>
                  onSelectEngineer({
                    id: engineerId,
                    name: engineerName,
                    email: item.email,
                    phone: item.phone,
                    specialization,
                  })
                }
              >
                <View style={styles.engineerAvatarContainer}>
                  <View style={styles.engineerAvatar}>
                    <Ionicons name="person-circle" size={48} color="#2E7D32" />
                  </View>
                  {unreadCount > 0 && (
                    <View style={styles.engineerBadge}>
                      <Text style={styles.engineerBadgeText}>
                        {unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.engineerInfo}>
                  <Text style={styles.engineerName}>{engineerName}</Text>
                  <Text style={styles.engineerSpecialty}>{specialization}</Text>
                  <Text style={styles.engineerDetail}>
                    {item.email || "No email"}
                  </Text>
                  {item.phone && (
                    <Text style={styles.engineerDetail}>{item.phone}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="construct-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Engineers Found</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "No engineers match your search"
                  : "No engineers are currently available"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// Chat Screen - Actual messaging interface with real API integration
function ChatScreen({ onBack, role, engineer }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(null);
  const flatListRef = useRef(null);

  // Determine recipient based on role
  const getRecipientRole = () => {
    switch (role?.id) {
      case "service_manager":
        return "service_manager";
      case "engineer":
        return "engineer";
      case "finance_manager":
        return "finance_manager";
      case "inventory_manager":
        return "inventory_manager";
      default:
        return role?.id || "service_manager";
    }
  };

  const recipientRole = getRecipientRole();
  const isEngineerChat = recipientRole === "engineer";
  const recipientId = isEngineerChat ? engineer?.id : null;

  useEffect(() => {
    loadUserAndMessages();

    // Set up polling for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadUserAndMessages = async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        setUser(userData);
        await fetchMessages(userData.id);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (customerId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = customerId || user?.id;

      if (!userId) return;

      let url;
      if (isEngineerChat && recipientId) {
        // Engineer: private chat with specific engineer
        url = `${BASE_URL}/api/messages/${userId}/engineer?recipientId=${recipientId}`;
      } else {
        // Non-engineer roles: shared inbox
        url = `${BASE_URL}/api/messages/${userId}/${recipientRole}`;
      }

      console.log("Fetching messages from:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Received messages:", data);

        // Handle both array response and object with messages property
        let messagesArray = [];
        if (Array.isArray(data)) {
          messagesArray = data;
        } else if (data.messages && Array.isArray(data.messages)) {
          messagesArray = data.messages;
        }

        const formattedMessages = messagesArray.map((msg) => {
          const isFromCustomer = msg.sender === "customer";
          return {
            id: msg.id || Math.random().toString(),
            text: msg.message || msg.content || "",
            sender: isFromCustomer ? "user" : "staff",
            time: new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: msg.created_at,
          };
        });

        // Sort by timestamp
        formattedMessages.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
        );

        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage("");

    // Add temporary message
    const tempMessage = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: new Date().toISOString(),
      isTemp: true,
    };

    setMessages((prev) => [...prev, tempMessage]);

    // Scroll to bottom after adding temp message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const token = await AsyncStorage.getItem("token");

      const messageData = {
        customer_id: user.id,
        sender: "customer",
        recipient_role: recipientRole,
        message: messageText,
      };

      // Add recipient_id for engineer messages
      if (isEngineerChat && recipientId) {
        messageData.recipient_id = recipientId;
      }

      console.log("Sending message:", messageData);

      const response = await fetch(`${BASE_URL}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log("Message sent successfully:", responseData);

        // Remove temp message and fetch real ones
        setMessages((prev) => prev.filter((msg) => !msg.isTemp));
        await fetchMessages();
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);

        // Remove temp message on error
        setMessages((prev) => prev.filter((msg) => !msg.isTemp));
        Alert.alert("Error", errorData.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => !msg.isTemp));
      Alert.alert("Error", "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const getChatTitle = () => {
    if (isEngineerChat && engineer) {
      return `Chat with ${engineer.name || "Engineer"}`;
    }
    return `Chat with ${role?.name || "Staff"}`;
  };

  const getChatStatus = () => {
    if (isEngineerChat) {
      return engineer?.email || "Engineer";
    }
    return "Online • Usually responds within an hour";
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <View style={styles.chatHeaderContent}>
          <View
            style={[
              styles.chatRoleIcon,
              {
                backgroundColor: isEngineerChat
                  ? "#81C784"
                  : role?.color || "#2E7D32",
              },
            ]}
          >
            <Ionicons
              name={isEngineerChat ? "construct" : role?.icon || "person"}
              size={20}
              color="white"
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>{getChatTitle()}</Text>
            <Text style={styles.chatStatus}>{getChatStatus()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchMessages}>
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.sender === "user"
                  ? styles.userMessage
                  : styles.staffMessage,
                item.isTemp && styles.tempMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  item.sender === "user"
                    ? styles.userMessageText
                    : styles.staffMessageText,
                ]}
              >
                {item.text}
              </Text>
              <Text style={styles.messageTime}>
                {item.time}
                {item.isTemp && " • Sending..."}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSubtext}>
                Send a message to start the conversation
              </Text>
            </View>
          }
        />

        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type your message..."
            placeholderTextColor="#94a3b8"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#2E7D32" />
            ) : (
              <Ionicons
                name="send"
                size={24}
                color={newMessage.trim() ? "#2E7D32" : "#cbd5e1"}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Support Screen
function SupportScreen({ onBack }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.screenContent}>
        <View style={styles.screenSection}>
          <View style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <Ionicons name="headset" size={48} color="#FF9800" />
            </View>
            <Text style={styles.screenTitle}>Customer Support</Text>
            <Text style={styles.screenDescription}>
              Our landscaping experts are here to help with any questions about
              your garden or outdoor space projects.
            </Text>

            <View style={styles.contactMethods}>
              <TouchableOpacity style={styles.contactMethod}>
                <View style={styles.methodIcon}>
                  <Ionicons name="call" size={24} color="#2E7D32" />
                </View>
                <View style={styles.methodContent}>
                  <Text style={styles.methodTitle}>Phone Support</Text>
                  <Text style={styles.methodValue}>+254 700 123 456</Text>
                  <Text style={styles.methodDescription}>
                    Call us for immediate assistance
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.contactMethod}>
                <View style={styles.methodIcon}>
                  <Ionicons name="mail" size={24} color="#2E7D32" />
                </View>
                <View style={styles.methodContent}>
                  <Text style={styles.methodTitle}>Email Support</Text>
                  <Text style={styles.methodValue}>support@botanica.co.ke</Text>
                  <Text style={styles.methodDescription}>
                    We respond within 24 hours
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <View style={styles.emergencyNotice}>
              <Ionicons name="warning" size={24} color="#FF9800" />
              <Text style={styles.emergencyText}>
                For urgent issues at your project site, please call our
                emergency line.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Help & FAQ Screen
function HelpScreen({ onBack }) {
  const faqs = [
    {
      question: "How do I book a landscaping service?",
      answer:
        "Go to the Services section, select your desired service, choose a preferred date, and complete the booking form.",
    },
    {
      question: "What areas do you serve?",
      answer:
        "We primarily serve Nairobi and its environs, including Karen, Lang'ata, Westlands, and surrounding areas.",
    },
    {
      question: "How long does a typical project take?",
      answer:
        "Project duration varies by scope. Small gardens take 1-3 days, while complete landscape designs may take 1-3 weeks.",
    },
    {
      question: "Do you provide maintenance after installation?",
      answer:
        "Yes, we offer ongoing garden maintenance packages tailored to your needs.",
    },
    {
      question: "How do I track my project progress?",
      answer:
        "You can track your project status in the My Bookings section, and communicate directly with your assigned engineer.",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.screenContent}>
        <View style={styles.screenSection}>
          <View style={styles.helpHeader}>
            <Ionicons name="help-circle" size={48} color="#9C27B0" />
            <Text style={styles.screenTitle}>Frequently Asked Questions</Text>
            <Text style={styles.screenDescription}>
              Find quick answers to common questions about our landscaping
              services.
            </Text>
          </View>

          <View style={styles.faqList}>
            {faqs.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons name="chevron-down" size={20} color="#64748b" />
                </View>
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// About Us Screen
function AboutScreen({ onBack }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.screenContent}>
        <View style={styles.screenSection}>
          <View style={styles.aboutHeader}>
            <View style={styles.aboutLogo}>
              <Ionicons name="leaf" size={48} color="#2E7D32" />
            </View>
            <Text style={styles.screenTitle}>
              Nairobi Botanica Gardening Limited
            </Text>
            <Text style={styles.screenDescription}>
              Headquartered in Karen, Nairobi, Kenya, we are a leading pioneer
              in landscaping services within the region. We provide bespoke
              landscape solutions tailored to clients' visions and budgets.
            </Text>
          </View>

          <View style={styles.aboutSection}>
            <Text style={styles.sectionSubtitle}>Our Expertise</Text>
            <Text style={styles.sectionText}>
              We specialize in Agriculture, Landscaping, Horticulture,
              Architecture, and Maintenance. Our passionate team focuses on
              delivering high-quality transformations of outdoor spaces.
            </Text>
          </View>

          <View style={styles.aboutSection}>
            <Text style={styles.sectionSubtitle}>Our Mission</Text>
            <Text style={styles.sectionText}>
              To modernize service delivery, improve customer satisfaction,
              streamline internal processes, and protect critical
              data—positioning ourselves as a technological leader in the
              landscaping industry.
            </Text>
          </View>

          <View style={styles.aboutSection}>
            <Text style={styles.sectionSubtitle}>Our Approach</Text>
            <Text style={styles.sectionText}>
              We are recognized for our professional, innovative, and
              customer-centric approach, with expertise in landscape design and
              implementation. Every project is tailored to create beautiful,
              sustainable outdoor spaces.
            </Text>
          </View>

          <View style={styles.contactInfo}>
            <Text style={styles.sectionSubtitle}>Visit Our Headquarters</Text>
            <View style={styles.contactItem}>
              <Ionicons name="location" size={20} color="#2E7D32" />
              <Text style={styles.contactText}>Karen, Nairobi, Kenya</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={20} color="#2E7D32" />
              <Text style={styles.contactText}>info@botanica.co.ke</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color="#2E7D32" />
              <Text style={styles.contactText}>+254 700 123 456</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Services Screen
function ServicesScreen({ onBack }) {
  const services = [
    {
      title: "Landscape Design",
      description:
        "Bespoke landscape designs tailored to your vision and budget.",
      icon: "color-palette-outline",
      color: "#2E7D32",
    },
    {
      title: "Garden Maintenance",
      description:
        "Regular maintenance to keep your garden beautiful year-round.",
      icon: "cut-outline",
      color: "#81C784",
    },
    {
      title: "Lawn Installation & Care",
      description: "Professional lawn installation and ongoing care services.",
      icon: "leaf-outline",
      color: "#4CAF50",
    },
    {
      title: "Irrigation Systems",
      description: "Efficient irrigation solutions for water conservation.",
      icon: "water-outline",
      color: "#0288D1",
    },
    {
      title: "Hardscape Construction",
      description: "Patios, walkways, and outdoor structures built to last.",
      icon: "construct-outline",
      color: "#FF9800",
    },
    {
      title: "Outdoor Lighting",
      description: "Enhance your outdoor space with professional lighting.",
      icon: "sunny-outline",
      color: "#FBC02D",
    },
    {
      title: "Tree Planting & Care",
      description: "Expert tree selection, planting, and maintenance.",
      icon: "flower-outline",
      color: "#2E7D32",
    },
    {
      title: "Plant Nursery Supplies",
      description: "Quality plants and materials for your garden projects.",
      icon: "storefront-outline",
      color: "#9C27B0",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Our Services</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.screenContent}>
        <View style={styles.screenSection}>
          <View style={styles.servicesHeader}>
            <Ionicons name="leaf" size={48} color="#2E7D32" />
            <Text style={styles.screenTitle}>
              Professional Landscaping Services
            </Text>
            <Text style={styles.screenDescription}>
              We offer comprehensive landscaping solutions tailored to transform
              your outdoor spaces into beautiful, sustainable environments.
            </Text>
          </View>

          <View style={styles.servicesGrid}>
            {services.map((service, index) => (
              <View key={index} style={styles.serviceCard}>
                <View
                  style={[
                    styles.serviceIcon,
                    { backgroundColor: service.color },
                  ]}
                >
                  <Ionicons name={service.icon} size={28} color="white" />
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceDescription}>
                  {service.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerSpacer: {
    width: 40,
  },
  logoutButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  profileHeader: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "white",
    marginBottom: 16,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#c8e6c9",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  userId: {
    fontSize: 12,
    color: "#94a3b8",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
  },
  menuSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  menuItem: {
    width: "48%",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    position: "relative",
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 10,
    color: "#cbd5e1",
    textAlign: "center",
  },
  screenContent: {
    flex: 1,
  },
  screenSection: {
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  screenDescription: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 24,
  },

  // Bookings styles
  filterTabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  activeFilterTab: {
    backgroundColor: "#2E7D32",
  },
  filterText: {
    fontSize: 14,
    color: "#64748b",
  },
  activeFilterText: {
    color: "white",
    fontWeight: "500",
  },
  bookingsList: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  serviceType: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2E7D32",
    marginBottom: 8,
  },
  bookingDetails: {
    marginBottom: 8,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  bookingLabel: {
    fontSize: 14,
    color: "#666",
    width: 90,
    marginLeft: 4,
  },
  bookingValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  descriptionBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },

  // Messages and roles styles
  roleGrid: {
    marginBottom: 24,
  },
  roleCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  roleIconContainer: {
    position: "relative",
    marginBottom: 12,
  },
  roleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  roleBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  roleBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
  roleName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },

  // Engineer list styles
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    marginLeft: 12,
    marginRight: 12,
  },
  engineerList: {
    padding: 16,
  },
  engineerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  engineerAvatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  engineerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
  },
  engineerBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "white",
  },
  engineerBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  engineerInfo: {
    flex: 1,
  },
  engineerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  engineerSpecialty: {
    fontSize: 13,
    color: "#2E7D32",
    fontWeight: "500",
    marginBottom: 2,
  },
  engineerDetail: {
    fontSize: 12,
    color: "#64748b",
  },

  // Chat styles
  chatHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 12,
  },
  chatRoleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  chatStatus: {
    fontSize: 12,
    color: "#2E7D32",
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 80,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#2E7D32",
    borderBottomRightRadius: 4,
  },
  staffMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 4,
  },
  tempMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 14,
    marginBottom: 4,
  },
  userMessageText: {
    color: "white",
  },
  staffMessageText: {
    color: "#1e293b",
  },
  messageTime: {
    fontSize: 10,
    color: "#94a3b8",
    alignSelf: "flex-end",
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "white",
  },
  messageInput: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 12,
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyChat: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },

  // Empty states
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },

  // Support styles
  supportCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  supportIcon: {
    alignItems: "center",
    marginBottom: 16,
  },
  contactMethods: {
    marginBottom: 24,
  },
  contactMethod: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  methodContent: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  methodValue: {
    fontSize: 14,
    color: "#2E7D32",
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 12,
    color: "#64748b",
  },
  emergencyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff3e0",
    padding: 16,
    borderRadius: 8,
  },
  emergencyText: {
    flex: 1,
    fontSize: 14,
    color: "#92400e",
    marginLeft: 12,
    lineHeight: 20,
  },

  // FAQ styles
  helpHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  faqList: {
    marginBottom: 24,
  },
  faqItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },

  // About styles
  aboutHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  aboutLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  aboutSection: {
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 22,
  },
  contactInfo: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  contactText: {
    fontSize: 15,
    color: "#1e293b",
    marginLeft: 12,
    flex: 1,
  },

  // Services styles
  servicesHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  serviceDescription: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});

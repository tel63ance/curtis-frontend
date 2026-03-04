// app/service_manager/profile.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { BASE_URL } from "../../config";

export default function ServiceManagerProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const messageListRef = useRef(null);

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  useEffect(() => {
    if (userData) {
      fetchInbox();
    }
  }, [userData]);

  useEffect(() => {
    let interval;
    if (showChat && selectedConversation) {
      fetchConversationMessages(selectedConversation.customer_id);
      interval = setInterval(() => {
        fetchConversationMessages(selectedConversation.customer_id);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [showChat, selectedConversation]);

  const checkAccessAndLoadData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (!storedUser) {
        router.replace("/login");
        return;
      }

      const user = JSON.parse(storedUser);
      // Check if user has service manager role
      if (user.role !== "service_manager" && user.role !== "admin") {
        Alert.alert(
          "Access Denied",
          "You don't have permission to access this page",
        );
        router.back();
        return;
      }

      setUserData(user);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load profile");
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

  // ============== FETCH INBOX ==============
  const fetchInbox = async () => {
    try {
      setApiError(null);
      const token = await getAuthToken();
      if (!token) {
        setApiError("Not authenticated");
        return;
      }

      console.log("🔍 Fetching inbox for service_manager...");

      // CORRECT ENDPOINT: /api/messages/inbox/service_manager
      const response = await axios.get(
        `${BASE_URL}/api/messages/inbox/service_manager`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log(`📥 Received inbox data:`, response.data);

      // Handle different response formats
      let inboxData = [];

      if (Array.isArray(response.data)) {
        inboxData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        inboxData = response.data.data;
      } else if (
        response.data?.conversations &&
        Array.isArray(response.data.conversations)
      ) {
        inboxData = response.data.conversations;
      }

      // Transform to your format
      const formattedConversations = inboxData.map((item) => {
        // Extract customer_id from the message data
        const customerId =
          item.customer_id ||
          item.sender_id ||
          item.recipient_id ||
          `CUST${Math.random().toString(36).substring(7)}`;

        return {
          id: customerId,
          customer_id: customerId,
          customer_name: item.customer_name || `Customer ${customerId}`,
          last_message: item.message || item.last_message || "No messages",
          last_message_time:
            item.created_at || item.updated_at || new Date().toISOString(),
          message_count: item.message_count || 1,
          unread_count: 0, // You'll need to calculate this based on read status
          messages: [],
        };
      });

      // If no conversations, create empty array
      if (formattedConversations.length === 0) {
        console.log("No conversations found");
        setConversations([]);
        return;
      }

      // Sort by most recent message
      formattedConversations.sort((a, b) => {
        return new Date(b.last_message_time) - new Date(a.last_message_time);
      });

      setConversations(formattedConversations);
      await saveConversations(formattedConversations);
    } catch (err) {
      console.error("❌ Error fetching inbox:", err);

      // Don't show error for 404 - just show empty state
      if (err.response?.status === 404) {
        console.log(
          "Inbox endpoint not found - messages feature may not be set up",
        );
        setConversations([]);
      } else {
        setApiError(err.message);
      }
    }
  };

  // Save conversations to AsyncStorage
  const saveConversations = async (convs) => {
    try {
      await AsyncStorage.setItem(
        "service_manager_conversations",
        JSON.stringify(convs),
      );
    } catch (error) {
      console.error("Error saving conversations:", error);
    }
  };

  // Load conversations from AsyncStorage (fallback)
  const loadSavedConversations = async () => {
    try {
      const saved = await AsyncStorage.getItem("service_manager_conversations");
      if (saved) {
        setConversations(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading saved conversations:", error);
    }
  };

  // ============== SEARCH FOR A CUSTOMER BY ID ==============
  const searchCustomer = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Error", "Please enter a customer ID");
      return;
    }

    const customerId = searchQuery.trim().toUpperCase();
    setIsSearching(true);
    setApiError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      console.log(`🔍 Searching for customer: ${customerId}`);

      // CORRECT ENDPOINT: /api/messages/:customerId/service_manager
      const response = await axios.get(
        `${BASE_URL}/api/messages/${customerId}/service_manager`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      let messagesData = [];
      if (Array.isArray(response.data)) {
        messagesData = response.data;
      } else if (
        response.data?.messages &&
        Array.isArray(response.data.messages)
      ) {
        messagesData = response.data.messages;
      }

      if (messagesData.length > 0) {
        console.log(
          `✅ Found ${messagesData.length} messages for ${customerId}`,
        );

        const lastMsg = messagesData[messagesData.length - 1];

        const newConversation = {
          id: customerId,
          customer_id: customerId,
          customer_name: `Customer ${customerId}`,
          last_message: lastMsg?.message || "No message",
          last_message_time: lastMsg?.created_at,
          message_count: messagesData.length,
          unread_count: 0,
          messages: messagesData,
        };

        // Check if conversation already exists
        const existingIndex = conversations.findIndex(
          (c) => c.customer_id === customerId,
        );

        let updatedConversations;
        if (existingIndex >= 0) {
          // Update existing conversation
          updatedConversations = [...conversations];
          updatedConversations[existingIndex] = newConversation;
        } else {
          // Add new conversation at the beginning
          updatedConversations = [newConversation, ...conversations];
        }

        // Sort by most recent
        updatedConversations.sort((a, b) => {
          return new Date(b.last_message_time) - new Date(a.last_message_time);
        });

        setConversations(updatedConversations);
        saveConversations(updatedConversations);

        // Select this conversation
        setSelectedConversation(newConversation);

        // Format and display messages
        formatAndSetMessages(messagesData);

        Alert.alert(
          "Success",
          `Found ${messagesData.length} message(s) from customer ${customerId}`,
        );
      } else {
        Alert.alert("Info", `No messages found for customer ${customerId}`);
      }
    } catch (err) {
      console.error("❌ Error searching:", err);

      if (err.response?.status === 404) {
        Alert.alert("Info", `No messages found for customer ${customerId}`);
      } else {
        setApiError(err.message);
        Alert.alert("Error", "Failed to search for customer");
      }
    } finally {
      setIsSearching(false);
      setSearchQuery("");
    }
  };

  // Format messages for display
  const formatAndSetMessages = (messagesData) => {
    const formattedMessages = messagesData.map((msg, index) => {
      const isFromCustomer =
        msg.sender === "customer" || msg.sender_role === "customer";
      const isFromService =
        msg.sender === "service_manager" ||
        msg.sender_role === "service_manager";

      return {
        id: msg.id || `msg_${Date.now()}_${index}`,
        content: msg.message || msg.content || "",
        sender_id: msg.sender_id,
        sender_name: isFromCustomer
          ? "Customer"
          : isFromService
            ? userData?.name || "Service Manager"
            : "Service Manager",
        sender_role: msg.sender || msg.sender_role,
        created_at: msg.created_at,
        is_from_customer: isFromCustomer,
        is_from_service: isFromService,
      };
    });

    setMessages(formattedMessages);

    // Scroll to bottom
    setTimeout(() => {
      messageListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Fetch messages for a specific conversation
  const fetchConversationMessages = async (customerId) => {
    setLoadingChat(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      console.log(`💬 Fetching messages for ${customerId}...`);

      // CORRECT ENDPOINT: /api/messages/:customerId/service_manager
      const response = await axios.get(
        `${BASE_URL}/api/messages/${customerId}/service_manager`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      let messagesData = [];
      if (Array.isArray(response.data)) {
        messagesData = response.data;
      } else if (
        response.data?.messages &&
        Array.isArray(response.data.messages)
      ) {
        messagesData = response.data.messages;
      }

      formatAndSetMessages(messagesData);

      // Update conversation in the list
      if (messagesData.length > 0) {
        const lastMsg = messagesData[messagesData.length - 1];
        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.customer_id === customerId
              ? {
                  ...conv,
                  last_message: lastMsg.message,
                  last_message_time: lastMsg.created_at,
                  message_count: messagesData.length,
                  messages: messagesData,
                }
              : conv,
          );

          // Re-sort after update
          updated.sort((a, b) => {
            return (
              new Date(b.last_message_time) - new Date(a.last_message_time)
            );
          });

          saveConversations(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error("❌ Error fetching messages:", err.message);
    } finally {
      setLoadingChat(false);
    }
  };

  // Send message to customer
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    const tempMessage = {
      id: Date.now().toString(),
      content: messageText,
      sender_id: userData?.id,
      sender_name: userData?.name || "Service Manager",
      sender_role: "service_manager",
      created_at: new Date().toISOString(),
      is_temp: true,
      is_from_customer: false,
      is_from_service: true,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const token = await getAuthToken();

      console.log("📤 Sending message to:", selectedConversation.customer_id);

      // CORRECT ENDPOINT: POST /api/messages
      await axios.post(
        `${BASE_URL}/api/messages`,
        {
          customer_id: selectedConversation.customer_id,
          sender: "service_manager",
          recipient_role: "service_manager",
          message: messageText,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Refresh messages
      await fetchConversationMessages(selectedConversation.customer_id);

      // Refresh inbox to update conversation list
      fetchInbox();
    } catch (err) {
      console.error(
        "❌ Error sending message:",
        err.response?.data || err.message,
      );
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      Alert.alert(
        "Error",
        err.response?.data?.error || "Failed to send message",
      );
    }
  };

  // Remove a conversation
  const removeConversation = (customerId) => {
    Alert.alert(
      "Remove Conversation",
      "Are you sure you want to remove this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const updated = conversations.filter(
              (c) => c.customer_id !== customerId,
            );
            setConversations(updated);
            saveConversations(updated);

            if (selectedConversation?.customer_id === customerId) {
              setSelectedConversation(null);
              setMessages([]);
            }
          },
        },
      ],
    );
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

  const formatMessageTime = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString("en-KE", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
        });
      }
    } catch (error) {
      return "";
    }
  };

  const getInitials = (name) => {
    if (!name) return "SM";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInbox();
    if (selectedConversation) {
      await fetchConversationMessages(selectedConversation.customer_id);
    }
    setRefreshing(false);
  };

  // Render message item
  const renderMessage = ({ item }) => {
    const isFromCustomer = item.is_from_customer;
    const isFromService = item.is_from_service;
    const isMe = isFromService;

    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.otherMessage,
        ]}
      >
        {!isMe && (
          <View style={styles.messageAvatar}>
            <Text style={styles.messageAvatarText}>C</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.otherBubble,
            item.is_temp && styles.tempMessage,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.content}
          </Text>
          <Text style={styles.messageTime}>
            {formatMessageTime(item.created_at)}
            {item.is_temp && " • Sending..."}
          </Text>
        </View>
      </View>
    );
  };

  // Render conversation item
  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => {
        setSelectedConversation(item);
        if (item.messages && item.messages.length > 0) {
          formatAndSetMessages(item.messages);
        } else {
          fetchConversationMessages(item.customer_id);
        }
      }}
      onLongPress={() => removeConversation(item.customer_id)}
    >
      <View style={styles.conversationAvatar}>
        <Text style={styles.conversationAvatarText}>
          {item.customer_id?.charAt(0) || "C"}
        </Text>
        {item.unread_count > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
          </View>
        ) : item.message_count > 0 ? (
          <View style={styles.messageCountBadge}>
            <Text style={styles.messageCountText}>{item.message_count}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.customer_name}
          </Text>
          <Text style={styles.conversationTime}>
            {formatMessageTime(item.last_message_time)}
          </Text>
        </View>
        <Text style={styles.conversationLastMessage} numberOfLines={2}>
          {item.last_message || "No messages yet"}
        </Text>
        <Text style={styles.conversationCustomerId}>
          ID: {item.customer_id}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2B5F3B" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // CHAT FULL SCREEN VIEW
  if (showChat) {
    const totalUnread = conversations.reduce(
      (acc, conv) => acc + (conv.unread_count || 0),
      0,
    );

    return (
      <View style={styles.chatFullScreen}>
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.chatBackButton}
            onPress={() => {
              setShowChat(false);
              setSelectedConversation(null);
              setMessages([]);
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#2B5F3B" />
          </TouchableOpacity>

          <Text style={styles.chatHeaderTitle}>
            {selectedConversation
              ? selectedConversation.customer_name
              : "Messages"}
          </Text>

          <TouchableOpacity style={styles.refreshButton} onPress={fetchInbox}>
            <Ionicons name="refresh" size={24} color="#2B5F3B" />
          </TouchableOpacity>
        </View>

        {!selectedConversation ? (
          // Conversations List with Search
          <>
            {/* Search Bar */}
            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Enter customer ID"
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="characters"
                  onSubmitEditing={searchCustomer}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    isSearching && styles.searchButtonDisabled,
                  ]}
                  onPress={searchCustomer}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="search" size={20} color="white" />
                      <Text style={styles.searchButtonText}>Search</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.searchHint}>
                {conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} • Pull down to refresh`
                  : "Enter a customer ID to search for messages"}
              </Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{conversations.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {conversations.reduce(
                    (acc, conv) => acc + (conv.message_count || 0),
                    0,
                  )}
                </Text>
                <Text style={styles.statLabel}>Messages</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalUnread}</Text>
                <Text style={styles.statLabel}>Unread</Text>
              </View>
            </View>

            {apiError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Error: {apiError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchInbox}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <FlatList
              data={conversations}
              renderItem={renderConversation}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.conversationsList}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#2B5F3B"]}
                  tintColor="#2B5F3B"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={64}
                    color="#d1d5db"
                  />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Enter a customer ID above to search for messages
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          // Messages View
          <KeyboardAvoidingView
            style={styles.messagesContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            {/* Customer Info */}
            <View style={styles.customerHeader}>
              <TouchableOpacity
                style={styles.customerBackButton}
                onPress={() => setSelectedConversation(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#2B5F3B" />
              </TouchableOpacity>
              <View style={styles.customerAvatar}>
                <Text style={styles.customerAvatarText}>
                  {selectedConversation.customer_id?.charAt(0) || "C"}
                </Text>
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {selectedConversation.customer_name}
                </Text>
                <Text style={styles.customerId}>
                  ID: {selectedConversation.customer_id}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.customerRefresh}
                onPress={() =>
                  fetchConversationMessages(selectedConversation.customer_id)
                }
              >
                <Ionicons name="refresh" size={20} color="#2B5F3B" />
              </TouchableOpacity>
            </View>

            <FlatList
              ref={messageListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() =>
                messageListRef.current?.scrollToEnd({ animated: true })
              }
              ListEmptyComponent={
                <View style={styles.emptyMessagesContainer}>
                  {loadingChat ? (
                    <>
                      <ActivityIndicator size="large" color="#2B5F3B" />
                      <Text style={styles.emptyMessagesText}>
                        Loading messages...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={48}
                        color="#d1d5db"
                      />
                      <Text style={styles.emptyMessagesText}>
                        No messages yet
                      </Text>
                      <Text style={styles.emptyMessagesSubtext}>
                        Send a message to start the conversation
                      </Text>
                    </>
                  )}
                </View>
              }
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#9ca3af"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={500}
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (newMessage.trim()) {
                    sendMessage();
                  }
                }}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessage.trim() && styles.sendButtonDisabled,
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={newMessage.trim() ? "#ffffff" : "#9ca3af"}
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    );
  }

  // PROFILE VIEW
  const totalConversations = conversations.length;
  const totalMessages = conversations.reduce(
    (acc, conv) => acc + (conv.message_count || 0),
    0,
  );
  const totalUnread = conversations.reduce(
    (acc, conv) => acc + (conv.unread_count || 0),
    0,
  );
  const latestMessage = conversations[0]?.last_message || "No messages yet";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Service Manager Profile</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2B5F3B"]}
            tintColor="#2B5F3B"
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(userData?.name || "Service Manager")}
              </Text>
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#2B5F3B" />
            </View>
          </View>

          <Text style={styles.userName}>
            {userData?.name || "Service Manager"}
          </Text>
          <Text style={styles.userEmail}>
            {userData?.email || "service@nairobidbotanica.com"}
          </Text>

          <View style={styles.roleBadge}>
            <Ionicons name="headset-outline" size={16} color="#2B5F3B" />
            <Text style={styles.roleText}>Service Manager</Text>
          </View>
        </View>

        {/* Messages Card - Shows detailed stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message Center</Text>

          <TouchableOpacity
            style={styles.messagesCard}
            onPress={() => setShowChat(true)}
          >
            <View style={styles.messagesHeader}>
              <View style={styles.messagesStats}>
                <View style={styles.messagesStat}>
                  <Text style={styles.messagesStatNumber}>
                    {totalConversations}
                  </Text>
                  <Text style={styles.messagesStatLabel}>Chats</Text>
                </View>
                <View style={styles.messagesStatDivider} />
                <View style={styles.messagesStat}>
                  <Text style={styles.messagesStatNumber}>{totalMessages}</Text>
                  <Text style={styles.messagesStatLabel}>Messages</Text>
                </View>
                <View style={styles.messagesStatDivider} />
                <View style={styles.messagesStat}>
                  <Text style={styles.messagesStatNumber}>{totalUnread}</Text>
                  <Text style={styles.messagesStatLabel}>Unread</Text>
                </View>
              </View>
            </View>

            <View style={styles.messagesFooter}>
              <View style={styles.messagesFooterLeft}>
                <Ionicons name="time-outline" size={16} color="#94a3b8" />
                <Text style={styles.messagesFooterText} numberOfLines={1}>
                  Latest: {latestMessage}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#2B5F3B" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="person-outline" size={20} color="#64748b" />
                <Text style={styles.infoLabel}>Full Name</Text>
              </View>
              <Text style={styles.infoValue}>
                {userData?.name || "Not set"}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748b" />
                <Text style={styles.infoLabel}>Email Address</Text>
              </View>
              <Text style={styles.infoValue}>
                {userData?.email || "Not set"}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="call-outline" size={20} color="#64748b" />
                <Text style={styles.infoLabel}>Phone Number</Text>
              </View>
              <Text style={styles.infoValue}>
                {userData?.phone || "Not set"}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="calendar-outline" size={20} color="#64748b" />
                <Text style={styles.infoLabel}>Date of Birth</Text>
              </View>
              <Text style={styles.infoValue}>
                {userData?.dob
                  ? new Date(userData.dob).toLocaleDateString()
                  : "Not set"}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="id-card-outline" size={20} color="#64748b" />
                <Text style={styles.infoLabel}>User ID</Text>
              </View>
              <Text style={styles.infoValue}>{userData?.id || "Not set"}</Text>
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <View style={styles.actionButtonContent}>
              <View
                style={[styles.actionIcon, { backgroundColor: "#ef444420" }]}
              >
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionTitle, { color: "#ef4444" }]}>
                  Logout
                </Text>
                <Text style={styles.actionSubtitle}>
                  Sign out from your account
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
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
  profileCard: {
    alignItems: "center",
    backgroundColor: "white",
    margin: 20,
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#e8f0e8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#c8e0c8",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "600",
    color: "#2B5F3B",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 2,
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
    marginBottom: 16,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2B5F3B20",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2B5F3B40",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2B5F3B",
    marginLeft: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  messagesCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  messagesHeader: {
    marginBottom: 12,
  },
  messagesStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  messagesStat: {
    alignItems: "center",
    flex: 1,
  },
  messagesStatNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2B5F3B",
    marginBottom: 4,
  },
  messagesStatLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  messagesStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#e5e7eb",
  },
  messagesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  messagesFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  messagesFooterText: {
    fontSize: 13,
    color: "#64748b",
    flex: 1,
  },
  infoCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: "#64748b",
    marginLeft: 8,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    textAlign: "right",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  // Chat Styles
  chatFullScreen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  chatBackButton: {
    padding: 4,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  refreshButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2B5F3B",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#e5e7eb",
  },
  conversationsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  conversationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e8f0e8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    position: "relative",
  },
  conversationAvatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2B5F3B",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "white",
  },
  unreadBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  messageCountBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#2B5F3B",
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "white",
  },
  messageCountText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  conversationLastMessage: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
    lineHeight: 18,
  },
  conversationCustomerId: {
    fontSize: 11,
    color: "#94a3b8",
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  customerBackButton: {
    marginRight: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e8f0e8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2B5F3B",
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  customerId: {
    fontSize: 12,
    color: "#64748b",
  },
  customerRefresh: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
  },
  myMessage: {
    justifyContent: "flex-end",
  },
  otherMessage: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8f0e8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    alignSelf: "flex-end",
  },
  messageAvatarText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2B5F3B",
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: "#2B5F3B",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tempMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  myMessageText: {
    color: "white",
  },
  otherMessageText: {
    color: "#1e293b",
  },
  messageTime: {
    fontSize: 10,
    color: "#94a3b8",
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 50,
    fontSize: 14,
    color: "#1e293b",
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    position: "absolute",
    right: 28,
    bottom: 22,
    backgroundColor: "#2B5F3B",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#e2e8f0",
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
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyMessagesContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyMessagesText: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    flex: 1,
  },
  retryButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  searchSection: {
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2B5F3B",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  searchHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
});

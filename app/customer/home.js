// Home.js
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BASE_URL } from "../../config";

const Home = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // State for real projects from API
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Filter projects when search term changes
  useEffect(() => {
    if (searchQuery) {
      const filtered = projects.filter(
        (project) =>
          project.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [searchQuery, projects]);

  const fetchProjects = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      const response = await axios.get(`${BASE_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Projects response:", response.data);

      // Map the API response to our project format
      // Only extract the fields we need: location (title from DB), description, completed_at, image_url
      const projectsData = Array.isArray(response.data)
        ? response.data
            .map((project) => ({
              id: project.project_id || project.id,
              location: project.title, // Map title from DB to location in frontend
              description: project.description || "No description available",
              completedDate: project.completed_at || project.created_at,
              imageUrl: project.image_url,
            }))
            .filter((project) => project.imageUrl) // Only show projects with images
        : [];

      setProjects(projectsData);
      setFilteredProjects(projectsData);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
      setFilteredProjects([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date not available";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Date not available";
    }
  };

  const renderProjectCard = ({ item }) => (
    <View style={styles.projectCard}>
      <LinearGradient
        colors={["#ffffff", "#f8f9fa"]}
        style={styles.projectCardGradient}
      >
        {/* Project Image */}
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.projectImage}
          resizeMode="cover"
        />

        <View style={styles.projectContent}>
          {/* Location (Title from DB) */}
          <View style={styles.projectLocation}>
            <MaterialIcons name="location-on" size={18} color="#2E7D32" />
            <Text style={styles.locationText}>
              {item.location || "Location not specified"}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.descriptionText} numberOfLines={3}>
            {item.description}
          </Text>

          {/* Completion Date */}
          <View style={styles.dateContainer}>
            <MaterialIcons name="date-range" size={16} color="#666" />
            <Text style={styles.dateText}>
              Completed: {formatDate(item.completedDate)}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Company Description */}
      <LinearGradient
        colors={["#1B5E20", "#2E7D32", "#388E3C"]}
        style={styles.companyHeader}
      >
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          defaultSource={require("../../assets/logo-placeholder.png")}
        />
        <Text style={styles.companyName}>
          Nairobi Botanica Gardening Limited
        </Text>
        <ScrollView style={styles.descriptionScroll}>
          <Text style={styles.companyDescription}>
            Nairobi Botanica Gardening Limited operates in Agriculture,
            Landscaping, Horticulture, Architecture and Maintenance. The company
            provides bespoke landscape solutions tailored to clients' visions
            and budgets. Headquartered in Karen, Nairobi, Kenya, it is a leading
            pioneer in landscaping services within the region.
          </Text>
          <Text style={styles.companyDescription}>
            The company is recognized for its professional, innovative, and
            customer-centric approach, with expertise in landscape design and
            implementation. Their passionate team focuses on delivering
            high-quality transformations of outdoor spaces.
          </Text>
        </ScrollView>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects by location or description..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Section Title */}
      <View style={styles.sectionTitleContainer}>
        <MaterialIcons name="photo-library" size={24} color="#2E7D32" />
        <Text style={styles.sectionTitle}>Our Completed Projects</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      <FlatList
        data={filteredProjects}
        renderItem={renderProjectCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.projectsList}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="photo-library" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No completed projects yet</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2E7D32"]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
  headerContainer: {
    marginBottom: 20,
  },
  companyHeader: {
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  companyName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  descriptionScroll: {
    maxHeight: 150,
  },
  companyDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 25,
    marginHorizontal: 20,
    marginTop: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  projectsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  projectCard: {
    marginBottom: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  projectCardGradient: {
    borderRadius: 15,
    overflow: "hidden",
  },
  projectImage: {
    width: "100%",
    height: 200,
  },
  projectContent: {
    padding: 15,
  },
  projectLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationText: {
    marginLeft: 5,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    marginLeft: 5,
    fontSize: 13,
    color: "#666",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    marginTop: 10,
  },
});

export default Home;

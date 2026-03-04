// app/auth/login.js
import { Ionicons, Octicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Formik } from "formik";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

// ================= BOTANICA INSPIRED COLOR PALETTE =================
const BotanicaColors = {
  // Earth & Nature Tones
  forestGreen: "#2B5F3B", // Deep forest green
  mossGreen: "#4A7856", // Soft moss
  oliveGreen: "#6A8D73", // Olive green
  sageGreen: "#8AA99B", // Sage green
  barkBrown: "#5D4A3A", // Tree bark
  earthBrown: "#7C5E4A", // Rich earth
  sandBeige: "#D4B68A", // Sandy path
  stoneGray: "#9BA5A9", // Stone
  mistGray: "#E5E9E7", // Morning mist
  skyBlue: "#87AFC7", // Sky through trees
  sunYellow: "#E6B450", // Dappled sunlight
  clayRed: "#B76E5A", // Red earth/clay
  leafGreen: "#9FB88B", // New leaves
  barkLight: "#8B7355", // Light bark
  blossomPink: "#E8B4B8", // Flower blossoms
  nectarGold: "#F0B27A", // Golden nectar

  // Functional Colors
  white: "#FFFFFF",
  black: "#2C3E2B",
  error: "#C44545", // Muted red (like fallen leaves)
  success: "#5F8B6F", // Muted green

  // Gradients
  gradientStart: "#2B5F3B",
  gradientEnd: "#4A7856",
};

export default function Login() {
  const [hidePassword, setHidePassword] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const router = useRouter();

  const handleMessage = (msg, type = "") => {
    setMessage(msg);
    setMessageType(type);
  };

  const handleRoleRedirect = (userData) => {
    const role = userData.role?.toLowerCase();

    const routeMap = {
      customer: "/customer/home",
      admin: "/admin/dashboard",
      engineer: "/engineer/dashboard",
      supplier: "/supplier/dashboard",
      service_manager: "/service_manager/dashboard",
      inventory_manager: "/inventory_manager/dashboard",
      finance_manager: "/finance_manager/dashboard",
    };

    const path = routeMap[role] || "/home";
    router.push(path);
  };

  const handleLogin = async (credentials, setSubmitting) => {
    handleMessage("");

    try {
      const url =
        "https://curtis-backend-production.up.railway.app/api/auth/login";
      const response = await axios.post(url, credentials, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      const result = response.data;
      console.log("LOGIN RESPONSE:", result);

      if (response.status === 200 && result.user) {
        await AsyncStorage.setItem("user", JSON.stringify(result.user));
        if (result.token) {
          await AsyncStorage.setItem("token", result.token);
        }
        handleRoleRedirect(result.user);
      } else {
        handleMessage(result.message || "Invalid credentials", "FAILED");
      }
    } catch (error) {
      console.log("LOGIN ERROR:", error.response?.data || error.message);
      handleMessage(
        error.response?.data?.message ||
          "Login failed. Check your credentials.",
        "FAILED",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BotanicaColors.sageGreen }}>
      <StatusBar style="light" />

      {/* Decorative Nature Elements - Background */}
      <View
        style={{
          position: "absolute",
          top: -50,
          right: -30,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: BotanicaColors.blossomPink,
          opacity: 0.15,
          transform: [{ scale: 1.5 }],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -50,
          left: -50,
          width: 250,
          height: 250,
          borderRadius: 125,
          backgroundColor: BotanicaColors.forestGreen,
          opacity: 0.15,
        }}
      />

      {/* Floating flower petals */}
      <View style={{ position: "absolute", top: 150, left: 30, opacity: 0.2 }}>
        <Ionicons name="flower" size={30} color={BotanicaColors.blossomPink} />
      </View>
      <View
        style={{ position: "absolute", bottom: 200, right: 40, opacity: 0.2 }}
      >
        <Ionicons name="flower" size={40} color={BotanicaColors.sunYellow} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              paddingHorizontal: 24,
              paddingVertical: 40,
            }}
          >
            {/* Main Card with Botanica-inspired design */}
            <BlurView
              intensity={20}
              tint="light"
              style={{
                borderRadius: 30,
                overflow: "hidden",
                backgroundColor: "rgba(255, 255, 255, 0.85)",
                padding: 24,
                shadowColor: BotanicaColors.forestGreen,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 12,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              {/* Decorative Flower Corner */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 100,
                  height: 100,
                  overflow: "hidden",
                  borderTopRightRadius: 30,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    backgroundColor: BotanicaColors.blossomPink,
                    opacity: 0.15,
                    transform: [{ rotate: "45deg" }],
                  }}
                />
              </View>

              {/* Logo Section - Botanica Flower Symbol */}
              <View style={{ alignItems: "center", marginBottom: 30 }}>
                <LinearGradient
                  colors={[
                    BotanicaColors.forestGreen,
                    BotanicaColors.mossGreen,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 55,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 15,
                    shadowColor: BotanicaColors.forestGreen,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 10,
                    borderWidth: 3,
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  }}
                >
                  {/* Flower Icon */}
                  <View style={{ alignItems: "center" }}>
                    <Ionicons
                      name="flower"
                      size={40}
                      color={BotanicaColors.sunYellow}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "800",
                        color: BotanicaColors.white,
                        letterSpacing: 2,
                        marginTop: -5,
                      }}
                    >
                      BOTANICA
                    </Text>
                  </View>
                </LinearGradient>

                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "300",
                    color: BotanicaColors.forestGreen,
                    letterSpacing: 3,
                    textAlign: "center",
                    fontFamily:
                      Platform.OS === "ios" ? "Avenir" : "sans-serif-light",
                  }}
                >
                  NAIROBI
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 1,
                      backgroundColor: BotanicaColors.sandBeige,
                      marginRight: 10,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      color: BotanicaColors.barkBrown,
                      fontStyle: "italic",
                    }}
                  >
                    Where Nature Meets Commerce
                  </Text>
                  <View
                    style={{
                      width: 30,
                      height: 1,
                      backgroundColor: BotanicaColors.sandBeige,
                      marginLeft: 10,
                    }}
                  />
                </View>
              </View>

              {/* Form Section */}
              <Formik
                initialValues={{ email: "", password: "" }}
                onSubmit={(values, { setSubmitting }) => {
                  if (!values.email || !values.password) {
                    handleMessage("Please fill in all fields", "FAILED");
                    setSubmitting(false);
                  } else {
                    handleLogin(values, setSubmitting);
                  }
                }}
              >
                {({
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  values,
                  isSubmitting,
                }) => (
                  <View style={{ width: "100%" }}>
                    {/* Email Input - Nature Inspired */}
                    <View style={{ marginBottom: 20 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Octicons
                          name="mail"
                          size={18}
                          color={BotanicaColors.forestGreen}
                        />
                        <Text
                          style={{
                            color: BotanicaColors.barkBrown,
                            fontSize: 14,
                            fontWeight: "500",
                            marginLeft: 8,
                          }}
                        >
                          Email Address
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: "rgba(138, 169, 155, 0.1)",
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: BotanicaColors.sandBeige,
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 15,
                        }}
                      >
                        <TextInput
                          style={{
                            flex: 1,
                            padding: 15,
                            fontSize: 16,
                            color: BotanicaColors.barkBrown,
                          }}
                          placeholder="your.email@example.com"
                          placeholderTextColor={BotanicaColors.stoneGray}
                          value={values.email}
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    {/* Password Input */}
                    <View style={{ marginBottom: 15 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Octicons
                          name="lock"
                          size={18}
                          color={BotanicaColors.forestGreen}
                        />
                        <Text
                          style={{
                            color: BotanicaColors.barkBrown,
                            fontSize: 14,
                            fontWeight: "500",
                            marginLeft: 8,
                          }}
                        >
                          Password
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: "rgba(138, 169, 155, 0.1)",
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: BotanicaColors.sandBeige,
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 15,
                        }}
                      >
                        <TextInput
                          style={{
                            flex: 1,
                            padding: 15,
                            fontSize: 16,
                            color: BotanicaColors.barkBrown,
                          }}
                          placeholder="••••••••"
                          placeholderTextColor={BotanicaColors.stoneGray}
                          value={values.password}
                          onChangeText={handleChange("password")}
                          onBlur={handleBlur("password")}
                          secureTextEntry={hidePassword}
                        />

                        <TouchableOpacity
                          onPress={() => setHidePassword(!hidePassword)}
                        >
                          <Ionicons
                            name={hidePassword ? "eye-off" : "eye"}
                            size={22}
                            color={BotanicaColors.stoneGray}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Message Box - Like a fallen leaf */}
                    {message ? (
                      <View
                        style={{
                          backgroundColor:
                            messageType === "SUCCESS"
                              ? "rgba(95, 139, 111, 0.1)"
                              : "rgba(196, 69, 69, 0.1)",
                          padding: 12,
                          borderRadius: 15,
                          marginTop: 10,
                          marginBottom: 5,
                          borderWidth: 1,
                          borderColor:
                            messageType === "SUCCESS"
                              ? BotanicaColors.success
                              : BotanicaColors.error,
                        }}
                      >
                        <Text
                          style={{
                            textAlign: "center",
                            fontSize: 13,
                            color:
                              messageType === "SUCCESS"
                                ? BotanicaColors.success
                                : BotanicaColors.error,
                          }}
                        >
                          {message}
                        </Text>
                      </View>
                    ) : null}

                    {/* Submit Button - Garden Path Design */}
                    {!isSubmitting ? (
                      <TouchableOpacity
                        style={{
                          marginTop: 25,
                          borderRadius: 25,
                          overflow: "hidden",
                          shadowColor: BotanicaColors.forestGreen,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 8,
                        }}
                        onPress={handleSubmit}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[
                            BotanicaColors.forestGreen,
                            BotanicaColors.mossGreen,
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            padding: 16,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: BotanicaColors.white,
                              fontSize: 18,
                              fontWeight: "600",
                              letterSpacing: 1,
                            }}
                          >
                            ENTER THE GARDEN
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{
                          backgroundColor: BotanicaColors.stoneGray,
                          padding: 16,
                          borderRadius: 25,
                          alignItems: "center",
                          marginTop: 25,
                          opacity: 0.7,
                        }}
                        disabled
                      >
                        <ActivityIndicator
                          size="large"
                          color={BotanicaColors.white}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Simple Sign Up Link */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        marginTop: 20,
                        marginBottom: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: BotanicaColors.barkBrown,
                          fontSize: 14,
                        }}
                      >
                        Don't have an account?{" "}
                      </Text>
                      <TouchableOpacity onPress={() => router.push("/signup")}>
                        <Text
                          style={{
                            color: BotanicaColors.forestGreen,
                            fontSize: 14,
                            fontWeight: "600",
                            textDecorationLine: "underline",
                            textDecorationColor: BotanicaColors.forestGreen,
                          }}
                        >
                          Sign Up
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </Formik>

              {/* Footer - Garden Ground */}
              <View
                style={{
                  marginTop: 20,
                  alignItems: "center",
                  borderTopWidth: 1,
                  borderTopColor: BotanicaColors.sandBeige,
                  paddingTop: 20,
                }}
              >
                <Text
                  style={{
                    color: BotanicaColors.barkBrown,
                    fontSize: 12,
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  © 2024 Nairobi Botanica · Cultivating Excellence
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: BotanicaColors.blossomPink,
                      marginHorizontal: 2,
                    }}
                  />
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: BotanicaColors.sunYellow,
                      marginHorizontal: 2,
                    }}
                  />
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: BotanicaColors.leafGreen,
                      marginHorizontal: 2,
                    }}
                  />
                </View>
              </View>
            </BlurView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

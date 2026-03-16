// app/auth/signup.js
import { Ionicons, Octicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Formik } from "formik";
import { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CredentialsContext } from "../components/credentialscontext";
import KeyboardAvoidingWrapper from "../components/KeyBoardAvoidingWrapper";

const { width, height } = Dimensions.get("window");

// ================= BOTANICA INSPIRED COLOR PALETTE =================
const BotanicaColors = {
  forestGreen: "#2B5F3B",
  mossGreen: "#4A7856",
  oliveGreen: "#6A8D73",
  sageGreen: "#8AA99B",
  barkBrown: "#5D4A3A",
  earthBrown: "#7C5E4A",
  sandBeige: "#D4B68A",
  stoneGray: "#9BA5A9",
  mistGray: "#E5E9E7",
  skyBlue: "#87AFC7",
  sunYellow: "#E6B450",
  clayRed: "#B76E5A",
  leafGreen: "#9FB88B",
  barkLight: "#8B7355",
  blossomPink: "#E8B4B8",
  nectarGold: "#F0B27A",
  white: "#FFFFFF",
  black: "#2C3E2B",
  error: "#C44545",
  success: "#5F8B6F",
};

// Email validation regex
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Phone validation (Kenyan format - can be adjusted)
const validatePhone = (phone) => {
  const re = /^(\+254|0)[7|1][0-9]{8}$/;
  return re.test(phone);
};

const Signup = () => {
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(new Date(2000, 0, 1));
  const [dob, setDob] = useState();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const { login } = useContext(CredentialsContext);
  const router = useRouter();

  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShow(false);
    setDate(currentDate);
    setDob(currentDate);
  };

  const showDatePicker = () => setShow(true);

  const handleMessage = (msg, type = "") => {
    setMessage(msg);
    setMessageType(type);
  };

  const handleSignup = async (credentials, setSubmitting) => {
    handleMessage(null);
    const url =
      "https://curtis-backend-production.up.railway.app/api/auth/register";

    const formattedDob = dob ? dob.toISOString().split("T")[0] : null;

    const finalData = {
      name: credentials.name,
      email: credentials.email,
      password: credentials.password,
      phone: credentials.phone,
      role: "Customer",
      dob: formattedDob,
      status: "Pending",
      source: "app",
    };

    try {
      const response = await axios.post(url, finalData);
      const result = response.data;

      if (response.status === 201) {
        handleMessage(
          "Account created successfully! Awaiting approval.",
          "SUCCESS",
        );

        // Show success message and redirect to login
        Alert.alert(
          "🌱 Success!",
          "Your account has been created successfully! Please login to continue.",
          [
            {
              text: "OK",
              onPress: () => router.push("/login"),
            },
          ],
        );
      } else {
        handleMessage(result.message || "Signup failed", "FAILED");
      }
    } catch (error) {
      console.log("Signup error:", error.response?.data || error.message);
      handleMessage(
        error.response?.data?.message || "Network error. Please try again.",
        "FAILED",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingWrapper backgroundColor={BotanicaColors.sageGreen}>
      <StatusBar style="light" />

      {/* Decorative Nature Elements - Background */}
      <View
        style={{
          position: "absolute",
          top: -60,
          right: -40,
          width: 250,
          height: 250,
          borderRadius: 125,
          backgroundColor: BotanicaColors.blossomPink,
          opacity: 0.15,
          transform: [{ scale: 1.2 }],
          zIndex: 0,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -70,
          left: -50,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: BotanicaColors.forestGreen,
          opacity: 0.15,
          zIndex: 0,
        }}
      />

      {/* Flower decorations */}
      <View
        style={{
          position: "absolute",
          top: 100,
          left: 20,
          transform: [{ rotate: "-15deg" }],
          zIndex: 0,
        }}
      >
        <Ionicons
          name="flower"
          size={40}
          color={BotanicaColors.blossomPink}
          style={{ opacity: 0.3 }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 150,
          right: 30,
          transform: [{ rotate: "45deg" }],
          zIndex: 0,
        }}
      >
        <Ionicons
          name="flower"
          size={50}
          color={BotanicaColors.sunYellow}
          style={{ opacity: 0.25 }}
        />
      </View>

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 20,
          zIndex: 1,
        }}
      >
        {/* Main Card with Botanica-inspired design */}
        <BlurView
          intensity={20}
          tint="light"
          style={{
            borderRadius: 30,
            overflow: "hidden",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: 24,
            shadowColor: BotanicaColors.forestGreen,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 12,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.4)",
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
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                backgroundColor: BotanicaColors.blossomPink,
                opacity: 0.15,
                transform: [{ rotate: "45deg" }],
              }}
            />
          </View>

          {/* Header Section */}
          <View style={{ alignItems: "center", marginBottom: 25 }}>
            <LinearGradient
              colors={[BotanicaColors.forestGreen, BotanicaColors.mossGreen]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 15,
                shadowColor: BotanicaColors.forestGreen,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                borderWidth: 2,
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <Ionicons
                name="flower"
                size={40}
                color={BotanicaColors.sunYellow}
              />
            </LinearGradient>

            <Text
              style={{
                fontSize: 24,
                fontWeight: "600",
                color: BotanicaColors.forestGreen,
                letterSpacing: 1,
                fontFamily: Platform.OS === "ios" ? "Avenir" : "sans-serif",
              }}
            >
              NAIROBI BOTANICA
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 5,
              }}
            >
              <View
                style={{
                  width: 25,
                  height: 1,
                  backgroundColor: BotanicaColors.sandBeige,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  fontSize: 16,
                  color: BotanicaColors.barkBrown,
                  fontStyle: "italic",
                }}
              >
                Plant Your Roots
              </Text>
              <View
                style={{
                  width: 25,
                  height: 1,
                  backgroundColor: BotanicaColors.sandBeige,
                  marginLeft: 8,
                }}
              />
            </View>
          </View>

          {show && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              is24Hour={true}
              display="default"
              onChange={onChange}
            />
          )}

          <Formik
            initialValues={{
              name: "",
              email: "",
              phone: "",
              password: "",
              confirmPassword: "",
            }}
            validate={(values) => {
              const errors = {};

              // Validate Name
              if (!values.name.trim()) {
                errors.name = "Name is required";
              }

              // Validate Email
              if (!values.email) {
                errors.email = "Email is required";
              } else if (!validateEmail(values.email)) {
                errors.email = "Please enter a valid email address";
              }

              // Validate Phone
              if (!values.phone) {
                errors.phone = "Phone number is required";
              } else if (!validatePhone(values.phone)) {
                errors.phone =
                  "Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)";
              }

              // Validate Password (only length)
              if (!values.password) {
                errors.password = "Password is required";
              } else if (values.password.length < 6) {
                errors.password = "Password must be at least 6 characters long";
              }

              // Validate Confirm Password
              if (!values.confirmPassword) {
                errors.confirmPassword = "Please confirm your password";
              } else if (values.password !== values.confirmPassword) {
                errors.confirmPassword = "Passwords do not match";
              }

              // Validate Date of Birth
              if (!dob) {
                errors.dob = "Date of birth is required";
              }

              return errors;
            }}
            onSubmit={(values, { setSubmitting }) => {
              handleSignup(values, setSubmitting);
            }}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isSubmitting,
            }) => (
              <View style={{ width: "100%" }}>
                {/* Name Field */}
                <MyTextInput
                  label="Full Name"
                  placeholder="Enter your Name"
                  placeholderTextColor={BotanicaColors.stoneGray}
                  onChangeText={handleChange("name")}
                  onBlur={handleBlur("name")}
                  value={values.name}
                  icon="person"
                  botanicaColors={BotanicaColors}
                  error={touched.name && errors.name}
                />

                {/* Email Field */}
                <MyTextInput
                  label="Email Address"
                  placeholder="Enter your Email"
                  placeholderTextColor={BotanicaColors.stoneGray}
                  onChangeText={handleChange("email")}
                  onBlur={handleBlur("email")}
                  value={values.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  icon="mail"
                  botanicaColors={BotanicaColors}
                  error={touched.email && errors.email}
                />

                {/* Phone Field */}
                <MyTextInput
                  label="Phone Number"
                  placeholder="Enter your Phone Number"
                  onChangeText={handleChange("phone")}
                  onBlur={handleBlur("phone")}
                  value={values.phone}
                  keyboardType="phone-pad"
                  icon="device-mobile"
                  botanicaColors={BotanicaColors}
                  error={touched.phone && errors.phone}
                />

                {/* Date of Birth Field */}
                <MyTextInput
                  label="Date of Birth"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={BotanicaColors.stoneGray}
                  value={dob ? dob.toDateString() : ""}
                  icon="calendar"
                  editable={false}
                  isDate={true}
                  showDatePicker={showDatePicker}
                  botanicaColors={BotanicaColors}
                  error={touched.dob && errors.dob}
                />

                {/* Password Field */}
                <MyTextInput
                  label="Password (min. 6 characters)"
                  placeholder="********"
                  placeholderTextColor={BotanicaColors.stoneGray}
                  onChangeText={handleChange("password")}
                  onBlur={handleBlur("password")}
                  value={values.password}
                  secureTextEntry={hidePassword}
                  icon="lock"
                  isPassword={true}
                  hidePassword={hidePassword}
                  setHidePassword={setHidePassword}
                  botanicaColors={BotanicaColors}
                  error={touched.password && errors.password}
                />

                {/* Confirm Password Field */}
                <MyTextInput
                  label="Confirm Password"
                  placeholder="********"
                  placeholderTextColor={BotanicaColors.stoneGray}
                  onChangeText={handleChange("confirmPassword")}
                  onBlur={handleBlur("confirmPassword")}
                  value={values.confirmPassword}
                  secureTextEntry={hideConfirmPassword}
                  icon="lock"
                  isPassword={true}
                  hidePassword={hideConfirmPassword}
                  setHidePassword={setHideConfirmPassword}
                  botanicaColors={BotanicaColors}
                  error={touched.confirmPassword && errors.confirmPassword}
                />

                {/* Message Box */}
                {message ? (
                  <View
                    style={{
                      backgroundColor:
                        messageType === "SUCCESS"
                          ? "rgba(95, 139, 111, 0.1)"
                          : "rgba(196, 69, 69, 0.1)",
                      padding: 12,
                      borderRadius: 15,
                      marginTop: 15,
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

                {/* Submit Button */}
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
                        Register Now
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

                {/* Divider */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginVertical: 20,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: BotanicaColors.sandBeige,
                    }}
                  />
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: BotanicaColors.blossomPink,
                      marginHorizontal: 10,
                    }}
                  />
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: BotanicaColors.sandBeige,
                    }}
                  />
                </View>

                {/* Login Link */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: BotanicaColors.barkBrown,
                      fontSize: 14,
                    }}
                  >
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/login")}>
                    <Text
                      style={{
                        color: BotanicaColors.forestGreen,
                        fontSize: 14,
                        fontWeight: "600",
                        textDecorationLine: "underline",
                        textDecorationColor: BotanicaColors.forestGreen,
                      }}
                    >
                      Log In
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Footer - Garden Ground */}
                <View
                  style={{
                    alignItems: "center",
                    marginTop: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
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
              </View>
            )}
          </Formik>
        </BlurView>
      </View>
    </KeyboardAvoidingWrapper>
  );
};

// 👁️ Custom input field with Botanica styling and error display
const MyTextInput = ({
  label,
  icon,
  isPassword,
  hidePassword,
  setHidePassword,
  isDate,
  showDatePicker,
  botanicaColors,
  error,
  ...props
}) => (
  <View style={{ marginBottom: 16 }}>
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
      }}
    >
      <Octicons name={icon} size={16} color={botanicaColors.forestGreen} />
      <Text
        style={{
          color: botanicaColors.barkBrown,
          fontSize: 14,
          fontWeight: "500",
          marginLeft: 8,
        }}
      >
        {label}
      </Text>
    </View>

    <View
      style={{
        backgroundColor: "rgba(138, 169, 155, 0.08)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: error ? botanicaColors.error : botanicaColors.sandBeige,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
      }}
    >
      {isDate ? (
        <TouchableOpacity
          onPress={showDatePicker}
          style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
        >
          <TextInput
            style={{
              flex: 1,
              padding: 14,
              fontSize: 15,
              color: botanicaColors.barkBrown,
            }}
            {...props}
          />
          <Ionicons
            name="calendar-outline"
            size={20}
            color={botanicaColors.mossGreen}
            style={{ marginRight: 5 }}
          />
        </TouchableOpacity>
      ) : (
        <TextInput
          style={{
            flex: 1,
            padding: 14,
            fontSize: 15,
            color: botanicaColors.barkBrown,
          }}
          placeholderTextColor={botanicaColors.stoneGray}
          {...props}
        />
      )}

      {isPassword && (
        <TouchableOpacity onPress={() => setHidePassword(!hidePassword)}>
          <Ionicons
            name={hidePassword ? "eye-off" : "eye"}
            size={22}
            color={botanicaColors.stoneGray}
          />
        </TouchableOpacity>
      )}
    </View>

    {error && (
      <Text
        style={{
          color: botanicaColors.error,
          fontSize: 12,
          marginTop: 4,
          marginLeft: 8,
        }}
      >
        {error}
      </Text>
    )}
  </View>
);

export default Signup;

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { createContext, useEffect, useState } from "react";

export const CredentialsContext = createContext();

export const CredentialsProvider = ({ children }) => {
  const [storedCredentials, setStoredCredentials] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== Load user from AsyncStorage on app start =====
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          setStoredCredentials(user);

          // Immediately set Axios header for all requests
          axios.defaults.headers.common["Authorization"] =
            `Bearer ${user.token}`;
          console.log("✅ Loaded user from storage:", user);
        }
      } catch (err) {
        console.error("❌ Error loading user:", err.message);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // ===== Login helper =====
  const login = async (user, token) => {
    try {
      // 1️⃣ Clear any existing user and axios headers
      setStoredCredentials(null);
      delete axios.defaults.headers.common["Authorization"];
      await AsyncStorage.removeItem("user");

      // 2️⃣ Persist new user
      const userData = { ...user, token };
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      setStoredCredentials(userData);

      // 3️⃣ Set Axios header immediately for all future requests
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log("📦 User logged in:", userData);
    } catch (err) {
      console.error("❌ Login failed:", err.message);
      throw err;
    }
  };

  // ===== Logout helper =====
  const logout = async () => {
    try {
      // Clear AsyncStorage and remove token from Axios
      await AsyncStorage.removeItem("user");
      setStoredCredentials(null);
      delete axios.defaults.headers.common["Authorization"];
      console.log("🧹 User logged out");
    } catch (err) {
      console.error("❌ Failed to logout:", err.message);
    }
  };

  return (
    <CredentialsContext.Provider
      value={{
        storedCredentials,
        setStoredCredentials,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </CredentialsContext.Provider>
  );
};

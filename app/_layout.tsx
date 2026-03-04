import { Stack } from "expo-router";
import { CredentialsProvider } from "../components/credentialscontext"; // ✅ Add this import

export default function RootLayout() {
  return (
    <CredentialsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="service_manager" />
        <Stack.Screen name="customer" />
        <Stack.Screen name="finance_manager" />
        <Stack.Screen name="technician" />
        <Stack.Screen name="supplier" />
        <Stack.Screen name="driver" />
        <Stack.Screen name="inventory_manager" />
      </Stack>
    </CredentialsProvider>
  );
}

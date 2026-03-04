// app/supplier/dashboard.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import { shareAsync } from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
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

// Company Information
const COMPANY_INFO = {
  name: "Nairobi Botanica Gardening Limited",
  shortName: "Nairobi Botanica",
  address: "Karen, Nairobi, Kenya",
  phone: "+254 700 000 000",
  email: "accounts@nairobbotanica.co.ke",
  website: "www.nairobbotanica.co.ke",
  tax_id: "P051-987-654-321",
  reg_number: "NBGL/2024/001",
};

export default function SupplierDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [supplierId, setSupplierId] = useState(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplies, setSupplies] = useState([]);
  const [filteredSupplies, setFilteredSupplies] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");

  // Quote modal state
  const [quoteModal, setQuoteModal] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Receipt modal state
  const [receiptModal, setReceiptModal] = useState(false);
  const [selectedReceiptSupply, setSelectedReceiptSupply] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    quoted: 0,
    approved: 0,
    rejected: 0,
    shipped: 0,
    delivered: 0,
    paid: 0,
  });

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  const checkAccessAndLoadData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (!storedUser) {
        router.replace("/login");
        return;
      }

      const user = JSON.parse(storedUser);
      if (user.role !== "supplier" && user.role !== "admin") {
        Alert.alert(
          "Access Denied",
          "You don't have permission to access this page",
        );
        router.back();
        return;
      }

      const id = user.id || user.user_id;
      setSupplierId(id);
      setSupplierName(user.name || "Supplier");
      setSupplierEmail(user.email || "");
      setSupplierPhone(user.phone || "");

      await fetchSupplies(id);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load dashboard");
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

  const fetchSupplies = async (id) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      const response = await fetch(`${BASE_URL}/api/supplies`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Filter supplies for this supplier
      const supplierSupplies = Array.isArray(data)
        ? data.filter((s) => s.supplier_id === id)
        : [];

      setSupplies(supplierSupplies);
      applyFilter(supplierSupplies, activeFilter);

      // Calculate stats
      const newStats = {
        total: supplierSupplies.length,
        pending: supplierSupplies.filter((s) => s.status === "pending").length,
        quoted: supplierSupplies.filter((s) => s.status === "quoted").length,
        approved: supplierSupplies.filter((s) => s.status === "approved")
          .length,
        rejected: supplierSupplies.filter((s) => s.status === "rejected")
          .length,
        shipped: supplierSupplies.filter((s) => s.status === "shipped").length,
        delivered: supplierSupplies.filter((s) => s.status === "delivered")
          .length,
        paid: supplierSupplies.filter((s) => s.status === "paid").length,
      };
      setStats(newStats);
    } catch (error) {
      console.error("❌ Error fetching supplies:", error);
      Alert.alert("Error", "Failed to fetch supplies");
    }
  };

  const applyFilter = (suppliesList, filter) => {
    if (filter === "all") {
      setFilteredSupplies(suppliesList);
    } else {
      setFilteredSupplies(suppliesList.filter((s) => s.status === filter));
    }
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    applyFilter(supplies, filter);
  };

  const openQuoteModal = (supply) => {
    // Only allow quoting if status is pending
    if (supply.status !== "pending") {
      Alert.alert(
        "Cannot Quote",
        `This request is ${supply.status}. You can only quote on pending requests.`,
      );
      return;
    }

    setSelectedSupply(supply);
    setQuoteAmount("");
    setQuoteModal(true);
  };
  const submitQuote = async () => {
    if (
      !quoteAmount.trim() ||
      isNaN(quoteAmount) ||
      parseFloat(quoteAmount) <= 0
    ) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    const quotedAmount = parseFloat(quoteAmount);
    const totalPrice =
      selectedSupply.total_price ||
      selectedSupply.quantity * selectedSupply.unit_price;

    if (quotedAmount >= totalPrice) {
      Alert.alert(
        "Invalid Quote",
        `Your quoted amount (${formatCurrency(quotedAmount)}) must be LESS than the total price (${formatCurrency(totalPrice)}).`,
      );
      return;
    }

    setUpdatingStatus(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      // Log the request details for debugging
      console.log("Submitting quote:", {
        url: `${BASE_URL}/api/supplies/${selectedSupply.id}/quote`,
        supply_id: selectedSupply.id,
        supplier_id: supplierId,
        quoted_amount: quotedAmount,
      });

      const response = await fetch(
        `${BASE_URL}/api/supplies/${selectedSupply.id}/quote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplier_id: supplierId,
            quoted_amount: quotedAmount,
            // Add supply_id in body as well to be safe (backend might expect it)
            supply_id: selectedSupply.id,
          }),
        },
      );

      const responseData = await response.json().catch(() => ({}));
      console.log("Quote response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to submit quote");
      }

      Alert.alert("Success", "Quote submitted successfully");
      setQuoteModal(false);

      if (supplierId) {
        await fetchSupplies(supplierId);
      }
    } catch (error) {
      console.error("❌ Error submitting quote:", error);
      Alert.alert("Error", error.message || "Failed to submit quote");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const markAsShipped = async (supply) => {
    // Only allow shipping if status is approved
    if (supply.status !== "approved") {
      Alert.alert(
        "Cannot Ship",
        `This request is ${supply.status}. You can only ship approved requests.`,
      );
      return;
    }

    Alert.alert(
      "Confirm Shipment",
      "Are you sure you want to mark this supply as shipped?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Ship",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(
                `${BASE_URL}/api/supplies/${supply.id}/ship`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    supplier_id: supplierId,
                  }),
                },
              );

              const responseData = await response.json().catch(() => ({}));

              if (!response.ok) {
                throw new Error(
                  responseData.error || "Failed to mark as shipped",
                );
              }

              Alert.alert("Success", "Supply marked as shipped");

              if (supplierId) {
                await fetchSupplies(supplierId);
              }
            } catch (error) {
              console.error("❌ Error marking as shipped:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to mark as shipped",
              );
            }
          },
        },
      ],
    );
  };

  const generateReceiptHTML = (supply) => {
    const receiptDate = new Date().toISOString();
    const receiptNumber = `RCP-${supply.id}-${new Date().getTime().toString().slice(-6)}`;
    const totalAmount = supply.supplier_quote || supply.total_price;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt ${supply.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap');
            
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 30px;
              color: #2D3E2D;
              background: #f5f5f0;
            }
            .receipt {
              max-width: 900px;
              margin: 0 auto;
              background: white;
              border-radius: 24px;
              padding: 40px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              border: 1px solid #e0e7e0;
            }
            .watermark {
              position: relative;
            }
            .watermark::after {
              content: "PAID";
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-15deg);
              font-size: 80px;
              font-weight: bold;
              color: rgba(46, 125, 50, 0.1);
              z-index: 0;
              pointer-events: none;
              white-space: nowrap;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #2E7D32;
              position: relative;
              z-index: 1;
            }
            .company-info {
              flex: 1;
            }
            .company-logo {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #2E7D32, #81C784);
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
              font-weight: bold;
              border-radius: 16px;
              margin-bottom: 15px;
              font-family: 'Playfair Display', serif;
            }
            .company-name {
              font-family: 'Playfair Display', serif;
              font-size: 28px;
              font-weight: bold;
              color: #2E7D32;
              margin: 0 0 5px;
            }
            .company-tagline {
              font-size: 12px;
              color: #81C784;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 10px;
            }
            .company-details {
              font-size: 13px;
              color: #64748b;
              line-height: 1.6;
            }
            .receipt-title {
              text-align: right;
              background: #f0f7f0;
              padding: 20px;
              border-radius: 16px;
            }
            .receipt-title h1 {
              font-family: 'Playfair Display', serif;
              font-size: 42px;
              margin: 0;
              color: #2E7D32;
              letter-spacing: 2px;
            }
            .receipt-title p {
              margin: 5px 0 0;
              color: #64748b;
              font-size: 14px;
              font-weight: 500;
            }
            .badge {
              background: #2E7D32;
              color: white;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              display: inline-block;
              margin-top: 10px;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              background: linear-gradient(135deg, #f8faf8, #f0f5f0);
              padding: 25px;
              border-radius: 16px;
              position: relative;
              z-index: 1;
            }
            .detail-item {
              text-align: center;
            }
            .detail-item h3 {
              font-size: 12px;
              color: #2E7D32;
              margin: 0 0 5px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .detail-item p {
              font-size: 20px;
              font-weight: 700;
              margin: 0;
              color: #1B5E20;
            }
            .detail-item small {
              font-size: 12px;
              color: #81C784;
            }
            .section {
              margin-bottom: 30px;
              position: relative;
              z-index: 1;
            }
            .section-title {
              font-family: 'Playfair Display', serif;
              font-size: 20px;
              font-weight: bold;
              color: #2E7D32;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e0e7e0;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              background: #f8faf8;
              padding: 20px;
              border-radius: 12px;
            }
            .info-row {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 12px;
              color: #81C784;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .info-value {
              font-size: 16px;
              font-weight: 600;
              color: #1B5E20;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            th {
              background: #2E7D32;
              color: white;
              padding: 15px;
              text-align: left;
              font-size: 14px;
              font-weight: 600;
            }
            td {
              padding: 15px;
              border-bottom: 1px solid #e0e7e0;
            }
            .total-row {
              background: #f0f7f0;
              font-weight: bold;
            }
            .total-row td {
              font-size: 16px;
              border-bottom: none;
            }
            .grand-total {
              background: #2E7D32;
              color: white;
            }
            .grand-total td {
              color: white;
              border-bottom: none;
            }
            .payment-summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-top: 20px;
            }
            .summary-item {
              text-align: center;
              padding: 15px;
              background: linear-gradient(135deg, #f8faf8, #f0f5f0);
              border-radius: 12px;
            }
            .summary-label {
              font-size: 11px;
              color: #81C784;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .summary-value {
              font-size: 18px;
              font-weight: bold;
              color: #1B5E20;
            }
            .terms {
              margin-top: 30px;
              padding: 20px;
              background: #f0f7f0;
              border-radius: 12px;
              font-size: 12px;
              color: #64748b;
              line-height: 1.6;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e0e7e0;
              display: grid;
              grid-template-columns: 2fr 1fr;
              gap: 20px;
              font-size: 11px;
              color: #64748b;
            }
            .thank-you {
              text-align: center;
              margin-top: 30px;
              padding: 30px;
              background: linear-gradient(135deg, #2E7D32, #1B5E20);
              border-radius: 16px;
            }
            .thank-you-text {
              font-family: 'Playfair Display', serif;
              font-size: 24px;
              color: white;
              margin-bottom: 10px;
            }
            .thank-you-sub {
              color: rgba(255,255,255,0.9);
              font-size: 14px;
            }
            .signature-area {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px dashed #81C784;
            }
            .signature {
              text-align: center;
              flex: 1;
            }
            .signature-line {
              margin-top: 40px;
              border-bottom: 1px solid #2E7D32;
              width: 200px;
            }
            .signature-label {
              font-size: 11px;
              color: #81C784;
              margin-top: 8px;
            }
            @media print {
              body { 
                background: white; 
                padding: 0;
              }
              .receipt { 
                box-shadow: none; 
                border: 1px solid #e0e7e0;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt watermark">
            <div class="header">
              <div class="company-info">
                <div class="company-logo">NB</div>
                <h1 class="company-name">${COMPANY_INFO.name}</h1>
                <div class="company-tagline">Landscape & Garden Excellence</div>
                <div class="company-details">
                  <div>${COMPANY_INFO.address}</div>
                  <div>Tel: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}</div>
                  <div>Website: ${COMPANY_INFO.website}</div>
                </div>
                <div class="badge">Tax ID: ${COMPANY_INFO.tax_id}</div>
              </div>
              <div class="receipt-title">
                <h1>RECEIPT</h1>
                <p>${receiptNumber}</p>
                <div style="margin-top: 10px; font-size: 12px; color: #81C784;">
                  Reg: ${COMPANY_INFO.reg_number}
                </div>
              </div>
            </div>

            <div class="details-grid">
              <div class="detail-item">
                <h3>Receipt Date</h3>
                <p>${new Date(receiptDate).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}</p>
                <small>${new Date(receiptDate).toLocaleTimeString("en-KE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</small>
              </div>
              <div class="detail-item">
                <h3>Payment Status</h3>
                <p style="color: #10b981;">✓ PAID</p>
                <small>Transaction Complete</small>
              </div>
              <div class="detail-item">
                <h3>Payment Method</h3>
                <p>Bank Transfer</p>
                <small>Verified</small>
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">Supplier Information</h2>
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Supplier ID</span>
                  <span class="info-value">${supplierId}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Business Name</span>
                  <span class="info-value">${supplierName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Email Address</span>
                  <span class="info-value">${supplierEmail}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Phone Number</span>
                  <span class="info-value">${supplierPhone}</span>
                </div>
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">Supply Information</h2>
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Supply ID</span>
                  <span class="info-value">${supply.id}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Item Name</span>
                  <span class="info-value">${supply.item_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Category</span>
                  <span class="info-value">${supply.category || "General"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Unit</span>
                  <span class="info-value">${supply.unit || "pcs"}</span>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Unit Price (KES)</th>
                  <th style="text-align: right;">Total (KES)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>${supply.item_name}</strong>
                    <br>
                    <span style="font-size: 11px; color: #81C784;">
                      Supply Request #${supply.id}
                    </span>
                  </td>
                  <td style="text-align: center;">${supply.quantity}</td>
                  <td style="text-align: right;">${parseFloat(
                    supply.supplier_quote || supply.unit_price,
                  ).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</td>
                  <td style="text-align: right; font-weight: 600;">${totalAmount.toLocaleString(
                    "en-KE",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}</td>
                </tr>
                ${
                  supply.notes
                    ? `
                <tr>
                  <td colspan="4" style="color: #64748b; background: #f8faf8;">
                    <strong>Notes:</strong> ${supply.notes}
                  </td>
                </tr>
                `
                    : ""
                }
                <tr class="total-row">
                  <td colspan="3" style="text-align: right; font-weight: bold;">Subtotal</td>
                  <td style="text-align: right;">${totalAmount.toLocaleString(
                    "en-KE",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}</td>
                </tr>
                <tr>
                  <td colspan="3" style="text-align: right;">VAT (0%)</td>
                  <td style="text-align: right;">0.00</td>
                </tr>
                <tr class="grand-total">
                  <td colspan="3" style="text-align: right; font-weight: bold;">GRAND TOTAL</td>
                  <td style="text-align: right; font-weight: bold; font-size: 18px;">
                    KES ${totalAmount.toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="payment-summary">
              <div class="summary-item">
                <div class="summary-label">Subtotal</div>
                <div class="summary-value">KES ${totalAmount.toLocaleString(
                  "en-KE",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                )}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">VAT (0%)</div>
                <div class="summary-value">KES 0.00</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Paid</div>
                <div class="summary-value" style="color: #2E7D32;">
                  KES ${totalAmount.toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Balance</div>
                <div class="summary-value" style="color: #10b981;">KES 0.00</div>
              </div>
            </div>

            <div class="terms">
              <strong style="color: #2E7D32;">Terms & Conditions:</strong>
              <p style="margin-top: 8px;">
                1. This receipt acknowledges payment for goods/services provided to Nairobi Botanica Gardening Limited.<br>
                2. Payment has been received in full for the above-mentioned items.<br>
                3. This is a computer-generated document and does not require a physical signature.<br>
                4. For any queries regarding this receipt, please contact our accounts department within 14 days.
              </p>
            </div>

            <div class="signature-area">
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-label">Authorized Signature</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-label">Company Stamp</div>
              </div>
            </div>

            <div class="footer">
              <div>
                <p style="font-weight: 600; color: #2E7D32;">${COMPANY_INFO.name}</p>
                <p>${COMPANY_INFO.address}</p>
                <p>${COMPANY_INFO.phone} | ${COMPANY_INFO.email}</p>
              </div>
              <div style="text-align: right;">
                <p>Tax ID: ${COMPANY_INFO.tax_id}</p>
                <p>Reg No: ${COMPANY_INFO.reg_number}</p>
                <p>${COMPANY_INFO.website}</p>
              </div>
            </div>

            <div class="thank-you">
              <div class="thank-you-text">Thank You for Your Partnership!</div>
              <div class="thank-you-sub">
                Your contribution helps us create beautiful outdoor spaces across Kenya.
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const generateAndDownloadReceipt = async (supply) => {
    setGeneratingPdf(true);
    try {
      const html = generateReceiptHTML(supply);
      const { uri } = await Print.printToFileAsync({ html });

      const fileName = `Receipt_${supply.id}_${new Date().toISOString().split("T")[0]}.pdf`;

      await shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });

      Alert.alert("Success", "Receipt generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate receipt");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const openReceiptModal = (supply) => {
    // Only allow receipt generation for paid supplies
    if (supply.status !== "paid") {
      Alert.alert(
        "Receipt Not Available",
        "Receipts are only available for paid supplies.",
      );
      return;
    }

    setSelectedReceiptSupply(supply);
    setReceiptModal(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (supplierId) {
      await fetchSupplies(supplierId);
    }
    setRefreshing(false);
  }, [supplierId]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return "KSh 0.00";
    return `KSh ${parseFloat(amount).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "quoted":
        return "#8b5cf6";
      case "approved":
        return "#10b981";
      case "rejected":
        return "#ef4444";
      case "shipped":
        return "#3b82f6";
      case "delivered":
        return "#2d6a4f";
      case "paid":
        return "#2E7D32";
      default:
        return "#64748b";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "quoted":
        return "pricetag-outline";
      case "approved":
        return "checkmark-circle-outline";
      case "rejected":
        return "close-circle-outline";
      case "shipped":
        return "cube-outline";
      case "delivered":
        return "checkmark-done-outline";
      case "paid":
        return "cash-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getStatusDescription = (status) => {
    switch (status) {
      case "pending":
        return "Awaiting your quote";
      case "quoted":
        return "Quote submitted - Awaiting manager approval";
      case "approved":
        return "Quote approved - Ready to ship";
      case "rejected":
        return "Quote rejected - You can submit a new quote";
      case "shipped":
        return "Shipped - Awaiting delivery confirmation";
      case "delivered":
        return "Delivered - Awaiting payment";
      case "paid":
        return "Payment received - Receipt available";
      default:
        return "";
    }
  };

  const renderSupplyCard = ({ item }) => {
    const totalPrice = item.total_price || item.quantity * item.unit_price;
    const canQuote = item.status === "pending";
    const canShip = item.status === "approved";
    const canGetReceipt = item.status === "paid";

    return (
      <View style={styles.supplyCard}>
        <View style={styles.supplyHeader}>
          <View style={styles.supplyIdContainer}>
            <Ionicons name="pricetag-outline" size={16} color="#2E7D32" />
            <Text style={styles.supplyId}>{item.id}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: `${getStatusColor(item.status)}20`,
              },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status)}
              size={14}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="leaf-outline" size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Product:</Text>
            <Text style={styles.infoValue}>{item.item_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="layers-outline" size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Quantity:</Text>
            <Text style={styles.infoValue}>
              {item.quantity} {item.unit || "pcs"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Requested:</Text>
            <Text style={styles.infoValue}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Total Price:</Text>
            <Text style={styles.infoValue}>{formatCurrency(totalPrice)}</Text>
          </View>

          {item.supplier_quote && (
            <View style={styles.infoRow}>
              <Ionicons name="pricetag-outline" size={16} color="#10b981" />
              <Text style={styles.infoLabel}>Your Quote:</Text>
              <Text style={[styles.infoValue, styles.quoteText]}>
                {formatCurrency(item.supplier_quote)}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#64748b"
            />
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, styles.statusDescription]}>
              {getStatusDescription(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {canQuote && (
            <TouchableOpacity
              style={[styles.actionButton, styles.quoteButton]}
              onPress={() => openQuoteModal(item)}
            >
              <Ionicons name="pricetag-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Submit Quote</Text>
            </TouchableOpacity>
          )}

          {canShip && (
            <TouchableOpacity
              style={[styles.actionButton, styles.shipButton]}
              onPress={() => markAsShipped(item)}
            >
              <Ionicons name="cube-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Mark Shipped</Text>
            </TouchableOpacity>
          )}

          {canGetReceipt && (
            <TouchableOpacity
              style={[styles.actionButton, styles.receiptButton]}
              onPress={() => openReceiptModal(item)}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="white"
                  />
                  <Text style={styles.actionButtonText}>Get Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Status indicators for other states */}
          {item.status === "quoted" && (
            <View
              style={[styles.statusIndicator, { backgroundColor: "#8b5cf620" }]}
            >
              <Ionicons name="time-outline" size={20} color="#8b5cf6" />
              <Text style={[styles.statusIndicatorText, { color: "#8b5cf6" }]}>
                Awaiting Approval
              </Text>
            </View>
          )}

          {item.status === "rejected" && (
            <View
              style={[styles.statusIndicator, { backgroundColor: "#ef444420" }]}
            >
              <Ionicons name="refresh-outline" size={20} color="#ef4444" />
              <Text style={[styles.statusIndicatorText, { color: "#ef4444" }]}>
                Rejected - Quote Again
              </Text>
            </View>
          )}

          {item.status === "shipped" && (
            <View
              style={[styles.statusIndicator, { backgroundColor: "#3b82f620" }]}
            >
              <Ionicons name="cube-outline" size={20} color="#3b82f6" />
              <Text style={[styles.statusIndicatorText, { color: "#3b82f6" }]}>
                Shipped - Awaiting Delivery
              </Text>
            </View>
          )}

          {item.status === "delivered" && (
            <View
              style={[styles.statusIndicator, { backgroundColor: "#2d6a4f20" }]}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={20}
                color="#2d6a4f"
              />
              <Text style={[styles.statusIndicatorText, { color: "#2d6a4f" }]}>
                Delivered - Awaiting Payment
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="leaf-outline" size={80} color="#81C784" />
      <Text style={styles.emptyTitle}>No Supply Requests</Text>
      <Text style={styles.emptyText}>
        {activeFilter === "all"
          ? "You don't have any supply requests yet"
          : `No ${activeFilter} supply requests found`}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Supplier Portal</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.welcomeBanner}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.supplierName}>{supplierName}</Text>
          <Text style={styles.supplierEmail}>{supplierEmail}</Text>
        </View>
        <View style={styles.supplierIdPill}>
          <Ionicons name="business-outline" size={16} color="#2E7D32" />
          <Text style={styles.supplierIdText}>ID: {supplierId}</Text>
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
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Supply Overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: "#64748b" }]}>
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#f59e0b" }]}>
                <Text style={styles.statNumber}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#8b5cf6" }]}>
                <Text style={styles.statNumber}>{stats.quoted}</Text>
                <Text style={styles.statLabel}>Quoted</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#10b981" }]}>
                <Text style={styles.statNumber}>{stats.approved}</Text>
                <Text style={styles.statLabel}>Approved</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#ef4444" }]}>
                <Text style={styles.statNumber}>{stats.rejected}</Text>
                <Text style={styles.statLabel}>Rejected</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#3b82f6" }]}>
                <Text style={styles.statNumber}>{stats.shipped}</Text>
                <Text style={styles.statLabel}>Shipped</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#2d6a4f" }]}>
                <Text style={styles.statNumber}>{stats.delivered}</Text>
                <Text style={styles.statLabel}>Delivered</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#2E7D32" }]}>
                <Text style={styles.statNumber}>{stats.paid}</Text>
                <Text style={styles.statLabel}>Paid</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === "all" && styles.activeFilterTab,
              ]}
              onPress={() => handleFilterChange("all")}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "all" && styles.activeFilterText,
                ]}
              >
                All ({stats.total})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === "pending" && styles.activeFilterTab,
              ]}
              onPress={() => handleFilterChange("pending")}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "pending" && styles.activeFilterText,
                ]}
              >
                Pending ({stats.pending})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === "quoted" && styles.activeFilterTab,
              ]}
              onPress={() => handleFilterChange("quoted")}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "quoted" && styles.activeFilterText,
                ]}
              >
                Quoted ({stats.quoted})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === "approved" && styles.activeFilterTab,
              ]}
              onPress={() => handleFilterChange("approved")}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "approved" && styles.activeFilterText,
                ]}
              >
                Approved ({stats.approved})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === "shipped" && styles.activeFilterTab,
              ]}
              onPress={() => handleFilterChange("shipped")}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === "shipped" && styles.activeFilterText,
                ]}
              >
                Shipped ({stats.shipped})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.suppliesSection}>
          <FlatList
            data={filteredSupplies}
            renderItem={renderSupplyCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.suppliesList}
            ListEmptyComponent={renderEmptyState}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Nairobi Botanica Supplier Portal
          </Text>
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Quote Modal */}
      <Modal
        visible={quoteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setQuoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Your Quote</Text>
              <TouchableOpacity
                onPress={() => setQuoteModal(false)}
                disabled={updatingStatus}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedSupply && (
              <View style={styles.modalBody}>
                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Product:</Text>
                  <Text style={styles.modalSupplyValue}>
                    {selectedSupply.item_name}
                  </Text>
                </View>
                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Quantity:</Text>
                  <Text style={styles.modalSupplyValue}>
                    {selectedSupply.quantity} {selectedSupply.unit || "pcs"}
                  </Text>
                </View>
                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Total Price:</Text>
                  <Text style={styles.modalSupplyValue}>
                    {formatCurrency(
                      selectedSupply.total_price ||
                        selectedSupply.quantity * selectedSupply.unit_price,
                    )}
                  </Text>
                </View>
                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Rule:</Text>
                  <Text style={[styles.modalSupplyValue, styles.warningText]}>
                    Your quote must be LESS than total price
                  </Text>
                </View>

                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalInputLabel}>
                    Your Quote Amount (KSh)
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter amount"
                    keyboardType="numeric"
                    value={quoteAmount}
                    onChangeText={setQuoteAmount}
                    editable={!updatingStatus}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setQuoteModal(false)}
                    disabled={updatingStatus}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalSubmitButton,
                      (!quoteAmount.trim() || updatingStatus) &&
                        styles.modalButtonDisabled,
                    ]}
                    onPress={submitQuote}
                    disabled={!quoteAmount.trim() || updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.modalSubmitButtonText}>
                        Submit Quote
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        visible={receiptModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReceiptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Receipt</Text>
              <TouchableOpacity
                onPress={() => setReceiptModal(false)}
                disabled={generatingPdf}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedReceiptSupply && (
              <View style={styles.modalBody}>
                <View style={styles.receiptPreview}>
                  <Ionicons name="document-text" size={48} color="#2E7D32" />
                  <Text style={styles.receiptPreviewText}>
                    Supply #{selectedReceiptSupply.id}
                  </Text>
                  <Text style={styles.receiptPreviewAmount}>
                    {formatCurrency(
                      selectedReceiptSupply.supplier_quote ||
                        selectedReceiptSupply.total_price,
                    )}
                  </Text>
                </View>

                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Item:</Text>
                  <Text style={styles.modalSupplyValue}>
                    {selectedReceiptSupply.item_name}
                  </Text>
                </View>

                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Quantity:</Text>
                  <Text style={styles.modalSupplyValue}>
                    {selectedReceiptSupply.quantity}{" "}
                    {selectedReceiptSupply.unit || "pcs"}
                  </Text>
                </View>

                <View style={styles.modalSupplyInfo}>
                  <Text style={styles.modalSupplyLabel}>Quote Amount:</Text>
                  <Text style={styles.modalSupplyValue}>
                    {formatCurrency(selectedReceiptSupply.supplier_quote)}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setReceiptModal(false)}
                    disabled={generatingPdf}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.receiptButton,
                      generatingPdf && styles.modalButtonDisabled,
                    ]}
                    onPress={() =>
                      generateAndDownloadReceipt(selectedReceiptSupply)
                    }
                    disabled={generatingPdf}
                  >
                    {generatingPdf ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons
                          name="download-outline"
                          size={20}
                          color="white"
                        />
                        <Text style={styles.modalSubmitButtonText}>
                          Download Receipt
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
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
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerPlaceholder: {
    width: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  welcomeBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  welcomeText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  supplierEmail: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  supplierIdPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  supplierIdText: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 16,
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
    paddingRight: 20,
  },
  statCard: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 80,
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
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  activeFilterTab: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  filterText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  activeFilterText: {
    color: "white",
  },
  suppliesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  suppliesList: {
    gap: 12,
  },
  supplyCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 8,
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
    gap: 6,
  },
  supplyId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  productInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#64748b",
    width: 90,
  },
  infoValue: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
  quoteText: {
    color: "#10b981",
    fontWeight: "600",
  },
  statusDescription: {
    color: "#64748b",
    fontStyle: "italic",
    fontSize: 12,
  },
  actionButtons: {
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  quoteButton: {
    backgroundColor: "#8b5cf6",
  },
  shipButton: {
    backgroundColor: "#3b82f6",
  },
  receiptButton: {
    backgroundColor: "#10b981",
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  statusIndicatorText: {
    fontSize: 14,
    fontWeight: "600",
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
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
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
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "90%",
    maxWidth: 400,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalBody: {
    gap: 16,
  },
  modalSupplyInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
  },
  modalSupplyLabel: {
    fontSize: 14,
    color: "#64748b",
    width: 100,
  },
  modalSupplyValue: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
    flex: 1,
  },
  warningText: {
    color: "#ef4444",
    fontStyle: "italic",
  },
  modalInputContainer: {
    gap: 8,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  modalInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
  modalCancelButton: {
    backgroundColor: "#f1f5f9",
  },
  modalCancelButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  modalSubmitButton: {
    backgroundColor: "#2E7D32",
  },
  modalSubmitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  receiptPreview: {
    alignItems: "center",
    backgroundColor: "#f0f7f0",
    padding: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  receiptPreviewText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 8,
  },
  receiptPreviewAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2E7D32",
    marginTop: 4,
  },
});

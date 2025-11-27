const axios = require("axios");

// SSLCommerz configuration
const SSLCOMMERZ_CONFIG = {
  store_id: process.env.SSLCOMMERZ_STORE_ID || "test_store_id",
  store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD || "test_password",
  is_live: false, // Set to true for production
  base_url: "https://sandbox.sslcommerz.com", // Use https://securepay.sslcommerz.com for live
};

// Initiate SSLCommerz payment
const initiateSSLCommerzPayment = async (paymentData) => {
  const {
    transactionId,
    amount,
    currency,
    customerName,
    customerEmail,
    courseTitle,
    successUrl,
    failUrl,
    cancelUrl,
  } = paymentData;

  try {
    // Prepare payment data for SSLCommerz
    const postData = {
      store_id: SSLCOMMERZ_CONFIG.store_id,
      store_passwd: SSLCOMMERZ_CONFIG.store_passwd,
      total_amount: amount,
      currency: currency,
      tran_id: transactionId,
      success_url: successUrl,
      fail_url: failUrl,
      cancel_url: cancelUrl,
      cus_name: customerName,
      cus_email: customerEmail,
      cus_phone: "01700000000", // Default phone, can be made dynamic
      cus_add1: "Dhaka, Bangladesh",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      product_name: courseTitle,
      product_category: "Education",
      product_profile: "general",
      num_of_item: 1,
      value_a: "", // Can be used to pass additional data
      value_b: "",
      value_c: "",
      value_d: "",
    };

    // In a real implementation, you would make the API call to SSLCommerz
    // For now, we'll simulate the response

    if (SSLCOMMERZ_CONFIG.is_live) {
      // Live API call
      const response = await axios.post(
        `${SSLCOMMERZ_CONFIG.base_url}/gwprocess/v4/api.php`,
        postData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      if (response.data.status === "SUCCESS") {
        return {
          paymentUrl: response.data.GatewayPageURL,
          sessionkey: response.data.sessionkey,
          transactionId,
        };
      } else {
        throw new Error("SSLCommerz payment initiation failed");
      }
    } else {
      // Sandbox simulation - return mock data
      console.log("SSLCommerz Sandbox Mode - Payment Data:", postData);

      // Simulate successful response
      return {
        paymentUrl: `${SSLCOMMERZ_CONFIG.base_url}/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=TEST_SESSION_KEY&tran_id=${transactionId}`,
        sessionkey: "TEST_SESSION_KEY",
        transactionId,
        status: "SUCCESS",
      };
    }
  } catch (error) {
    console.error("SSLCommerz payment initiation error:", error);
    throw new Error("Failed to initiate SSLCommerz payment");
  }
};

// Verify SSLCommerz payment (for webhook/callback validation)
const verifySSLCommerzPayment = async (transactionId, sessionkey) => {
  try {
    if (SSLCOMMERZ_CONFIG.is_live) {
      // Live verification
      const response = await axios.post(
        `${SSLCOMMERZ_CONFIG.base_url}/validator/api/validationserverAPI.php`,
        {
          store_id: SSLCOMMERZ_CONFIG.store_id,
          store_passwd: SSLCOMMERZ_CONFIG.store_passwd,
          tran_id: transactionId,
          sessionkey: sessionkey,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      return {
        isValid: response.data.status === "VALID",
        data: response.data,
      };
    } else {
      // Sandbox simulation
      console.log("SSLCommerz Sandbox Mode - Verification for:", transactionId);

      // Simulate valid payment
      return {
        isValid: true,
        data: {
          status: "VALID",
          tran_id: transactionId,
          amount: "100.00", // Mock amount
          currency: "BDT",
          card_type: "VISA",
          risk_level: "0",
          risk_title: "Safe",
        },
      };
    }
  } catch (error) {
    console.error("SSLCommerz payment verification error:", error);
    return {
      isValid: false,
      error: error.message,
    };
  }
};

module.exports = {
  initiateSSLCommerzPayment,
  verifySSLCommerzPayment,
};
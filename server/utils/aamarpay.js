const axios = require("axios");
const crypto = require("crypto");

// AamarPay configuration
const AAMARPAY_CONFIG = {
  store_id: process.env.AAMARPAY_STORE_ID || "test_store_id",
  signature_key: process.env.AAMARPAY_SIGNATURE_KEY || "test_signature_key",
  is_live: false, // Set to true for production
  base_url: "https://sandbox.aamarpay.com", // Use https://secure.aamarpay.com for live
};

// Initiate AamarPay payment
const initiateAamarPayPayment = async (paymentData) => {
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
    // Prepare payment data for AamarPay
    const postData = {
      store_id: AAMARPAY_CONFIG.store_id,
      signature_key: AAMARPAY_CONFIG.signature_key,
      tran_id: transactionId,
      amount: amount.toString(),
      currency: currency,
      desc: `Payment for ${courseTitle}`,
      cus_name: customerName,
      cus_email: customerEmail,
      cus_phone: "01700000000", // Default phone, can be made dynamic
      cus_add1: "Dhaka, Bangladesh",
      cus_add2: "",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1200",
      cus_country: "Bangladesh",
      success_url: successUrl,
      fail_url: failUrl,
      cancel_url: cancelUrl,
      type: "json", // Response type
    };

    // In a real implementation, you would make the API call to AamarPay
    // For now, we'll simulate the response

    if (AAMARPAY_CONFIG.is_live) {
      // Live API call
      const response = await axios.post(
        `${AAMARPAY_CONFIG.base_url}/jsonpost.php`,
        postData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.result === "true") {
        return {
          paymentUrl: response.data.payment_url,
          transactionId,
          payment_id: response.data.payment_id,
        };
      } else {
        throw new Error("AamarPay payment initiation failed");
      }
    } else {
      // Sandbox simulation - return mock data
      console.log("AamarPay Sandbox Mode - Payment Data:", postData);

      // Simulate successful response
      return {
        paymentUrl: `${AAMARPAY_CONFIG.base_url}/index.php?payment_id=TEST_PAYMENT_ID&tran_id=${transactionId}`,
        transactionId,
        payment_id: "TEST_PAYMENT_ID",
        result: "true",
      };
    }
  } catch (error) {
    console.error("AamarPay payment initiation error:", error);
    throw new Error("Failed to initiate AamarPay payment");
  }
};

// Verify AamarPay payment (for webhook/callback validation)
const verifyAamarPayPayment = async (paymentId, transactionId) => {
  try {
    if (AAMARPAY_CONFIG.is_live) {
      // Live verification
      const response = await axios.post(
        `${AAMARPAY_CONFIG.base_url}/api/v1/trxcheck/request.php`,
        {
          store_id: AAMARPAY_CONFIG.store_id,
          signature_key: AAMARPAY_CONFIG.signature_key,
          type: "json",
          request_id: paymentId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        isValid: response.data.pay_status === "Successful",
        data: response.data,
      };
    } else {
      // Sandbox simulation
      console.log("AamarPay Sandbox Mode - Verification for:", paymentId, transactionId);

      // Simulate valid payment
      return {
        isValid: true,
        data: {
          payment_id: paymentId,
          tran_id: transactionId,
          pay_status: "Successful",
          amount: "100.00", // Mock amount
          currency: "BDT",
          pay_time: new Date().toISOString(),
          cus_name: "Test Customer",
          cus_email: "test@example.com",
        },
      };
    }
  } catch (error) {
    console.error("AamarPay payment verification error:", error);
    return {
      isValid: false,
      error: error.message,
    };
  }
};

// Validate AamarPay webhook signature
const validateAamarPayWebhook = (webhookData, signature) => {
  try {
    // Create signature string from webhook data
    const signatureString = Object.keys(webhookData)
      .sort()
      .map(key => `${key}=${webhookData[key]}`)
      .join('&');

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', AAMARPAY_CONFIG.signature_key)
      .update(signatureString)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error("AamarPay webhook validation error:", error);
    return false;
  }
};

module.exports = {
  initiateAamarPayPayment,
  verifyAamarPayPayment,
  validateAamarPayWebhook,
};
const axios = require("axios");
const mongoose = require("mongoose");

// Configuration
const BASE_URL = "http://localhost:5001";
const TEST_USER = {
  userName: `testuser_${Date.now()}`,
  userEmail: `testuser_${Date.now()}@example.com`,
  password: "TestPass123!",
  role: "student",
};

let authToken = "";
let instructorToken = "";
let testCourseId = "";
let testQuizId = "";
let testAttemptId = "";
let testQuizAutoOnlyId = "";
let testQuizMixedId = "";
let testQuizBroadTextOnlyId = "";
let testAttemptAutoOnlyId = "";
let testAttemptMixedId = "";
let testAttemptBroadTextOnlyId = "";

// Test data
const TEST_INSTRUCTOR = {
  userName: `testinstructor_${Date.now()}`,
  userEmail: `testinstructor_${Date.now()}@example.com`,
  password: "TestPass123!",
  role: "instructor",
};

const TEST_COURSE = {
  instructorId: "", // Will be set after instructor login
  instructorName: "Test Instructor",
  date: new Date(),
  title: "Test Course for Quiz System",
  category: "Technology",
  level: "beginner",
  primaryLanguage: "English",
  subtitle: "Test Course Subtitle",
  description: "A test course to validate quiz functionality",
  image: "https://example.com/test-image.jpg",
  welcomeMessage: "Welcome to the test course!",
  pricing: 99,
  courseType: "paid",
  objectives: "Learn quiz functionality",
  students: [],
  curriculum: [
    {
      title: "Introduction",
      videoUrl: "https://example.com/test-video.mp4",
      public_id: "test-public-id",
      freePreview: true,
    },
  ],
  isPublished: true,
};

const TEST_QUIZ_AUTO_ONLY = {
  title: "Auto-Gradable Only Quiz",
  description: "Quiz with only auto-gradable questions",
  courseId: "", // Will be set after course creation
  quizType: "final",
  questions: [
    {
      type: "multiple-choice",
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correctAnswer: "2",
      points: 2,
      requiresReview: false,
    },
    {
      type: "true-false",
      question: "Is JavaScript a programming language?",
      options: ["True", "False"],
      correctAnswer: "0",
      points: 1,
      requiresReview: false,
    },
    {
      type: "multiple-choice",
      question: "Select all programming languages",
      options: ["JavaScript", "HTML", "Python", "CSS"],
      correctAnswer: "0",
      points: 1,
      requiresReview: false,
    },
  ],
  timeLimit: 30,
  passingScore: 70,
  attemptsAllowed: 3,
  createdBy: "", // Will be set after instructor login
};

const TEST_QUIZ_MIXED = {
  title: "Mixed Quiz",
  description: "Quiz with auto-gradable and broad-text questions",
  courseId: "", // Will be set after course creation
  quizType: "final",
  questions: [
    {
      type: "multiple-choice",
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correctAnswer: "2",
      points: 2,
      requiresReview: false,
    },
    {
      type: "broad-text",
      question: "Explain the concept of recursion in programming.",
      options: [],
      points: 3,
      requiresReview: true,
    },
  ],
  timeLimit: 30,
  passingScore: 60,
  attemptsAllowed: 3,
  createdBy: "", // Will be set after instructor login
};

const TEST_QUIZ_BROAD_TEXT_ONLY = {
  title: "Broad Text Only Quiz",
  description: "Quiz with only broad-text questions",
  courseId: "", // Will be set after course creation
  quizType: "final",
  questions: [
    {
      type: "broad-text",
      question: "Describe the water cycle in detail.",
      options: [],
      points: 5,
      requiresReview: true,
    },
    {
      type: "broad-text",
      question: "Explain how photosynthesis works.",
      options: [],
      points: 5,
      requiresReview: true,
    },
  ],
  timeLimit: 30,
  passingScore: 70,
  attemptsAllowed: 3,
  createdBy: "", // Will be set after instructor login
};

// Helper functions
async function makeRequest(method, url, data = null, token = null) {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

async function log(message, result = null) {
  console.log(`\n[${new Date().toISOString()}] ${message}`);
  if (result) {
    if (result.success) {
      console.log("✅ SUCCESS:", JSON.stringify(result.data, null, 2));
    } else {
      console.log("❌ ERROR:", JSON.stringify(result.error, null, 2));
    }
  }
}

// Test functions
async function testUserRegistration() {
  log("Testing user registration...");
  const result = await makeRequest("POST", "/auth/register", TEST_USER);
  log("Registration result:", result);
  return result.success;
}

async function testUserLogin() {
  log("Testing user login...");
  const result = await makeRequest("POST", "/auth/login", {
    userEmail: TEST_USER.userEmail,
    password: TEST_USER.password,
  });
  if (result.success) {
    authToken = result.data.data.accessToken;
    log("Login successful, token obtained");
  }
  log("Login result:", result);
  return result.success;
}

async function testInstructorRegistration() {
  log("Testing instructor registration...");
  const result = await makeRequest("POST", "/auth/register", TEST_INSTRUCTOR);
  log("Instructor registration result:", result);
  return result.success;
}

async function testInstructorLogin() {
  log("Testing instructor login...");
  const result = await makeRequest("POST", "/auth/login", {
    userEmail: TEST_INSTRUCTOR.userEmail,
    password: TEST_INSTRUCTOR.password,
  });
  if (result.success) {
    instructorToken = result.data.data.accessToken;
    TEST_COURSE.instructorId = result.data.data.user._id;
    TEST_QUIZ_AUTO_ONLY.createdBy = result.data.data.user._id;
    TEST_QUIZ_MIXED.createdBy = result.data.data.user._id;
    TEST_QUIZ_BROAD_TEXT_ONLY.createdBy = result.data.data.user._id;
    log("Instructor login successful, token obtained");
  }
  log("Instructor login result:", result);
  return result.success;
}

async function testCourseCreation() {
  log("Testing course creation...");
  const result = await makeRequest(
    "POST",
    "/instructor/course/add",
    TEST_COURSE,
    instructorToken
  );
  if (result.success) {
    testCourseId = result.data.data._id;
    TEST_QUIZ_AUTO_ONLY.courseId = testCourseId;
    TEST_QUIZ_MIXED.courseId = testCourseId;
    TEST_QUIZ_BROAD_TEXT_ONLY.courseId = testCourseId;
    log(`Course created with ID: ${testCourseId}`);
  }
  log("Course creation result:", result);
  return result.success;
}

async function testCourseEnrollment() {
  log("Testing course enrollment...");
  const enrollmentData = {
    userId: "", // Will be set after login
    userName: TEST_USER.userName,
    userEmail: TEST_USER.userEmail,
    orderStatus: "confirmed",
    paymentMethod: "card", // Since course is paid
    paymentStatus: "completed",
    orderDate: new Date(),
    paymentId: "TEST_PAYMENT_ID",
    payerId: "TEST_PAYER_ID",
    instructorId: TEST_COURSE.instructorId,
    instructorName: TEST_COURSE.instructorName,
    courseImage: TEST_COURSE.image,
    courseTitle: TEST_COURSE.title,
    courseId: testCourseId,
    coursePricing: TEST_COURSE.pricing,
  };

  // Get user ID from login response (assuming we have it stored)
  // We need to get the user ID from the login response
  const userLoginResult = await makeRequest("POST", "/auth/login", {
    userEmail: TEST_USER.userEmail,
    password: TEST_USER.password,
  });
  if (userLoginResult.success) {
    enrollmentData.userId = userLoginResult.data.data.user._id;
  } else {
    log("Failed to get user ID for enrollment");
    return false;
  }

  const result = await makeRequest(
    "POST",
    "/student/order/create",
    enrollmentData,
    authToken
  );
  log("Course enrollment result:", result);
  return result.success;
}

async function testQuizCreation() {
  log("Testing quiz creation...");

  // Create auto-only quiz
  const autoOnlyResult = await makeRequest(
    "POST",
    "/instructor/quiz/create",
    TEST_QUIZ_AUTO_ONLY,
    instructorToken
  );
  if (autoOnlyResult.success) {
    testQuizAutoOnlyId = autoOnlyResult.data.data._id;
    log(`Auto-only quiz created with ID: ${testQuizAutoOnlyId}`);
  } else {
    log("Auto-only quiz creation failed:", autoOnlyResult.error);
  }

  // Create mixed quiz
  const mixedResult = await makeRequest(
    "POST",
    "/instructor/quiz/create",
    TEST_QUIZ_MIXED,
    instructorToken
  );
  if (mixedResult.success) {
    testQuizMixedId = mixedResult.data.data._id;
    log(`Mixed quiz created with ID: ${testQuizMixedId}`);
  } else {
    log("Mixed quiz creation failed:", mixedResult.error);
  }

  // Create broad-text only quiz
  const broadTextOnlyResult = await makeRequest(
    "POST",
    "/instructor/quiz/create",
    TEST_QUIZ_BROAD_TEXT_ONLY,
    instructorToken
  );
  if (broadTextOnlyResult.success) {
    testQuizBroadTextOnlyId = broadTextOnlyResult.data.data._id;
    log(`Broad-text only quiz created with ID: ${testQuizBroadTextOnlyId}`);
  } else {
    log("Broad-text only quiz creation failed:", broadTextOnlyResult.error);
  }

  const allSuccess =
    autoOnlyResult.success &&
    mixedResult.success &&
    broadTextOnlyResult.success;
  log("Quiz creation results:", {
    autoOnlyResult: autoOnlyResult.success,
    mixedResult: mixedResult.success,
    broadTextOnlyResult: broadTextOnlyResult.success,
  });
  return allSuccess;
}

async function testQuizRetrieval() {
  log("Testing quiz retrieval for students...");
  const result = await makeRequest(
    "GET",
    `/student/quiz/course/${testCourseId}`,
    null,
    authToken
  );
  log("Quiz retrieval result:", result);
  if (result.success) {
    const quizzes = result.data.data;
    log(`Retrieved ${quizzes.length} quizzes for the course`);
    // Should have 3 quizzes now
    if (quizzes.length !== 3) {
      log(`❌ ERROR: Expected 3 quizzes, got ${quizzes.length}`);
      return false;
    }
  }
  return result.success;
}

async function testQuizAttemptStart() {
  log("Testing quiz attempt starts...");

  // Start auto-only quiz attempt
  const autoOnlyResult = await makeRequest(
    "POST",
    `/student/quiz/${testQuizAutoOnlyId}/attempt`,
    {},
    authToken
  );
  if (autoOnlyResult.success) {
    testAttemptAutoOnlyId = autoOnlyResult.data.data.attemptId;
    log(`Auto-only quiz attempt started with ID: ${testAttemptAutoOnlyId}`);
  }

  // Start mixed quiz attempt
  const mixedResult = await makeRequest(
    "POST",
    `/student/quiz/${testQuizMixedId}/attempt`,
    {},
    authToken
  );
  if (mixedResult.success) {
    testAttemptMixedId = mixedResult.data.data.attemptId;
    log(`Mixed quiz attempt started with ID: ${testAttemptMixedId}`);
  }

  // Start broad-text only quiz attempt
  const broadTextOnlyResult = await makeRequest(
    "POST",
    `/student/quiz/${testQuizBroadTextOnlyId}/attempt`,
    {},
    authToken
  );
  if (broadTextOnlyResult.success) {
    testAttemptBroadTextOnlyId = broadTextOnlyResult.data.data.attemptId;
    log(
      `Broad-text only quiz attempt started with ID: ${testAttemptBroadTextOnlyId}`
    );
  }

  const allSuccess =
    autoOnlyResult.success &&
    mixedResult.success &&
    broadTextOnlyResult.success;
  log("Quiz attempt start results:", {
    autoOnlyResult,
    mixedResult,
    broadTextOnlyResult,
  });
  return allSuccess;
}

async function testQuizSubmissionAutoOnly() {
  log("Testing auto-only quiz submission...");

  if (!testAttemptAutoOnlyId) {
    log("❌ ERROR: testAttemptAutoOnlyId is empty or undefined.");
    return false;
  }

  // Get the actual question IDs from the quiz
  const quizResponse = await makeRequest(
    "GET",
    `/student/quiz/${testQuizAutoOnlyId}`,
    null,
    authToken
  );

  if (!quizResponse.success) {
    log("Failed to get auto-only quiz details");
    return false;
  }

  const questionIds = quizResponse.data.data.quiz.questions.map((q) => q._id);

  // All correct answers for 100% score
  const answers = [
    { questionId: questionIds[0], answer: "2" }, // Correct
    { questionId: questionIds[1], answer: "0" }, // Correct
    { questionId: questionIds[2], answer: "0" }, // Correct
  ];

  const result = await makeRequest(
    "PUT",
    `/student/quiz/${testQuizAutoOnlyId}/attempt/${testAttemptAutoOnlyId}`,
    { answers },
    authToken
  );
  log("Auto-only quiz submission result:", result);
  return result.success;
}

async function testQuizSubmissionMixed() {
  log("Testing mixed quiz submission...");

  if (!testAttemptMixedId) {
    log("❌ ERROR: testAttemptMixedId is empty or undefined.");
    return false;
  }

  // Get the actual question IDs from the quiz
  const quizResponse = await makeRequest(
    "GET",
    `/student/quiz/${testQuizMixedId}`,
    null,
    authToken
  );

  if (!quizResponse.success) {
    log("Failed to get mixed quiz details");
    return false;
  }

  const questionIds = quizResponse.data.data.quiz.questions.map((q) => q._id);

  // One correct auto-gradable, one broad-text
  const answers = [
    { questionId: questionIds[0], answer: "2" }, // Correct multiple-choice
    {
      questionId: questionIds[1],
      answer: "This is my explanation of recursion...",
    }, // Broad-text
  ];

  const result = await makeRequest(
    "PUT",
    `/student/quiz/${testQuizMixedId}/attempt/${testAttemptMixedId}`,
    { answers },
    authToken
  );
  log("Mixed quiz submission result:", result);
  return result.success;
}

async function testQuizSubmissionBroadTextOnly() {
  log("Testing broad-text only quiz submission...");

  if (!testAttemptBroadTextOnlyId) {
    log("❌ ERROR: testAttemptBroadTextOnlyId is empty or undefined.");
    return false;
  }

  // Get the actual question IDs from the quiz
  const quizResponse = await makeRequest(
    "GET",
    `/student/quiz/${testQuizBroadTextOnlyId}`,
    null,
    authToken
  );

  if (!quizResponse.success) {
    log("Failed to get broad-text only quiz details");
    return false;
  }

  const questionIds = quizResponse.data.data.quiz.questions.map((q) => q._id);

  // Two broad-text answers
  const answers = [
    { questionId: questionIds[0], answer: "The water cycle explanation..." },
    { questionId: questionIds[1], answer: "Photosynthesis explanation..." },
  ];

  const result = await makeRequest(
    "PUT",
    `/student/quiz/${testQuizBroadTextOnlyId}/attempt/${testAttemptBroadTextOnlyId}`,
    { answers },
    authToken
  );
  log("Broad-text only quiz submission result:", result);
  return result.success;
}

async function testQuizResultsAutoOnly() {
  log("Testing auto-only quiz results retrieval...");
  const result = await makeRequest(
    "GET",
    `/student/quiz/${testQuizAutoOnlyId}/results`,
    null,
    authToken
  );
  log("Auto-only quiz results:", result);
  if (result.success) {
    const score = result.data.score;
    const passed = result.data.passed;
    log(`Auto-only quiz - Score: ${score}%, Passed: ${passed}`);
    // Should be 100% since all answers were correct
    if (score !== 100) {
      log("❌ ERROR: Expected 100% score for auto-only quiz");
      return false;
    }
  }
  return result.success;
}

async function testQuizResultsMixed() {
  log("Testing mixed quiz results retrieval...");
  const result = await makeRequest(
    "GET",
    `/student/quiz/${testQuizMixedId}/results`,
    null,
    authToken
  );
  log("Mixed quiz results:", result);
  if (result.success) {
    const score = result.data.score;
    const passed = result.data.passed;
    log(`Mixed quiz - Score: ${score}%, Passed: ${passed}`);
    // Should be 40% (2/5 points from auto-gradable question only)
    const expectedScore = Math.round((2 / 2) * 100); // 2 points out of 2 auto-gradable points
    if (score !== expectedScore) {
      log(
        `❌ ERROR: Expected ${expectedScore}% score for mixed quiz, got ${score}%`
      );
      return false;
    }
  }
  return result.success;
}

async function testQuizResultsBroadTextOnly() {
  log("Testing broad-text only quiz results retrieval...");
  const result = await makeRequest(
    "GET",
    `/student/quiz/${testQuizBroadTextOnlyId}/results`,
    null,
    authToken
  );
  log("Broad-text only quiz results:", result);
  if (result.success) {
    const score = result.data.score;
    const passed = result.data.passed;
    log(`Broad-text only quiz - Score: ${score}%, Passed: ${passed}`);
    // Should be 0% since no auto-gradable questions
    if (score !== 0) {
      log("❌ ERROR: Expected 0% score for broad-text only quiz");
      return false;
    }
  }
  return result.success;
}

async function testSecurityFeatures() {
  log("Testing security features...");

  // Test unauthorized access
  const unauthorizedResult = await makeRequest(
    "GET",
    `/student/quiz/course/${testCourseId}`
  );
  log("Unauthorized access test:", unauthorizedResult);

  // Test invalid token
  const invalidTokenResult = await makeRequest(
    "GET",
    `/student/quiz/course/${testCourseId}`,
    null,
    "invalid-token"
  );
  log("Invalid token test:", invalidTokenResult);

  return (
    unauthorizedResult.success === false && invalidTokenResult.success === false
  );
}

async function testErrorHandling() {
  log("Testing error handling...");

  // Test invalid quiz ID
  const invalidQuizResult = await makeRequest(
    "GET",
    "/student/quiz/invalid-id/results",
    null,
    authToken
  );
  log("Invalid quiz ID test:", invalidQuizResult);

  // Test invalid course ID
  const invalidCourseResult = await makeRequest(
    "GET",
    "/student/quiz/course/invalid-id",
    null,
    authToken
  );
  log("Invalid course ID test:", invalidCourseResult);

  return (
    invalidQuizResult.success === false && invalidCourseResult.success === false
  );
}

// Test instructor review process
async function testInstructorReview() {
  log("Testing instructor review process...");

  // Get unreviewed answers
  const unreviewedResult = await makeRequest(
    "GET",
    "/instructor/quiz/unreviewed-answers",
    null,
    instructorToken
  );
  log("Unreviewed answers result:", unreviewedResult);

  if (!unreviewedResult.success || unreviewedResult.data.data.length === 0) {
    log("❌ ERROR: No unreviewed answers found");
    return false;
  }

  // Find the mixed quiz attempt
  const mixedAttempt = unreviewedResult.data.data.find(
    (attempt) => attempt.quizId._id.toString() === testQuizMixedId
  );

  if (!mixedAttempt) {
    log("❌ ERROR: Mixed quiz attempt not found in unreviewed answers");
    return false;
  }

  // Find the broad-text answer in the mixed attempt
  const broadTextAnswer = mixedAttempt.answers.find(
    (answer) => answer.needsReview === true
  );

  if (!broadTextAnswer) {
    log("❌ ERROR: Broad-text answer not found");
    return false;
  }

  // Review the broad-text answer (give full points)
  const reviewData = {
    pointsEarned: 3, // Full points for the broad-text question
    reviewNotes: "Good explanation of recursion concepts.",
  };

  const reviewResult = await makeRequest(
    "PUT",
    `/instructor/quiz/review-answer/${mixedAttempt._id}/${broadTextAnswer.questionId}`,
    reviewData,
    instructorToken
  );
  log("Review result:", reviewResult);

  if (!reviewResult.success) {
    return false;
  }

  // Check updated results
  const updatedResults = await makeRequest(
    "GET",
    `/student/quiz/${testQuizMixedId}/results`,
    null,
    authToken
  );
  log("Updated mixed quiz results after review:", updatedResults);

  if (updatedResults.success) {
    const score = updatedResults.data.score;
    const passed = updatedResults.data.passed;
    log(`Mixed quiz after review - Score: ${score}%, Passed: ${passed}`);
    // Should now be 100% (2 auto-gradable + 3 broad-text = 5/5 points)
    if (score !== 100) {
      log(`❌ ERROR: Expected 100% score after review, got ${score}%`);
      return false;
    }
  }

  return updatedResults.success;
}

// Main test execution
async function runTests() {
  console.log("🚀 Starting Quiz Scoring Fix Validation Tests\n");

  const results = {
    userRegistration: await testUserRegistration(),
    userLogin: await testUserLogin(),
    instructorRegistration: await testInstructorRegistration(),
    instructorLogin: await testInstructorLogin(),
    courseCreation: await testCourseCreation(),
    courseEnrollment: await testCourseEnrollment(),
    quizCreation: await testQuizCreation(),
    quizRetrieval: await testQuizRetrieval(),
    quizAttemptStart: await testQuizAttemptStart(),
    quizSubmissionAutoOnly: await testQuizSubmissionAutoOnly(),
    quizSubmissionMixed: await testQuizSubmissionMixed(),
    quizSubmissionBroadTextOnly: await testQuizSubmissionBroadTextOnly(),
    quizResultsAutoOnly: await testQuizResultsAutoOnly(),
    quizResultsMixed: await testQuizResultsMixed(),
    quizResultsBroadTextOnly: await testQuizResultsBroadTextOnly(),
    instructorReview: await testInstructorReview(),
    securityFeatures: await testSecurityFeatures(),
    errorHandling: await testErrorHandling(),
  };

  console.log("\n📊 Test Results Summary:");
  console.log("========================");

  let passed = 0;
  let failed = 0;

  Object.entries(results).forEach(([test, success]) => {
    const status = success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: ${test}`);
    if (success) passed++;
    else failed++;
  });

  console.log(`\nTotal Tests: ${Object.keys(results).length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(
    `Success Rate: ${((passed / Object.keys(results).length) * 100).toFixed(
      1
    )}%`
  );

  if (failed === 0) {
    console.log(
      "\n🎉 All tests passed! Quiz scoring fix is working correctly."
    );
  } else {
    console.log(
      `\n⚠️ ${failed} test(s) failed. Please review the issues above.`
    );
  }

  // Cleanup
  await mongoose.disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the tests
runTests().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});

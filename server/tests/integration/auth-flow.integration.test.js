const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Import your app - adjust path as needed
const app = require("../../server");

let mongoServer;

describe("Authentication Flow Integration Tests", () => {
  let server;
  let agent;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to test database
    await mongoose.connect(mongoUri);

    // Start the server
    server = app.listen(5001);
    agent = request.agent(server);
  });

  afterAll(async () => {
    // Close server and database
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe("Registration → Login → Course Enrollment → Quiz Submission Flow", () => {
    let studentToken, instructorToken, courseId, quizId, attemptId;

    const testStudent = {
      userName: `teststudent_${Date.now()}`,
      userEmail: `teststudent_${Date.now()}@example.com`,
      password: "Test@123456",
      role: "student",
    };

    const testInstructor = {
      userName: `testinstructor_${Date.now()}`,
      userEmail: `testinstructor_${Date.now()}@example.com`,
      password: "Test@123456",
      role: "instructor",
    };

    const testCourse = {
      instructorId: "", // Will be set after instructor login
      instructorName: "Test Instructor",
      date: new Date(),
      title: "Integration Test Course",
      category: "Technology",
      level: "beginner",
      primaryLanguage: "English",
      subtitle: "Test Course Subtitle",
      description: "A test course for integration testing",
      image: "https://example.com/test-image.jpg",
      welcomeMessage: "Welcome to the test course!",
      pricing: 99,
      courseType: "paid",
      objectives: "Learn integration testing",
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

    const testQuiz = {
      title: "Integration Test Quiz",
      description: "Quiz for integration testing",
      courseId: "", // Will be set after course creation
      lectureId: "", // Will be set after course creation
      quizType: "lesson",
      questions: [
        {
          type: "multiple-choice",
          question: "What is 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: "1", // Index 1 = '4'
          points: 2,
          requiresReview: false,
        },
      ],
      timeLimit: 30,
      passingScore: 70,
      attemptsAllowed: 3,
      createdBy: "", // Will be set after instructor login
    };

    test("Step 1: Student Registration", async () => {
      const response = await agent
        .post("/auth/register")
        .send(testStudent)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty("_id");
      expect(response.body.data.user.userEmail).toBe(testStudent.userEmail);
    });

    test("Step 2: Student Login", async () => {
      const response = await agent
        .post("/auth/login")
        .send({
          userEmail: testStudent.userEmail,
          password: testStudent.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("user");

      studentToken = response.body.data.accessToken;
    });

    test("Step 3: Instructor Registration", async () => {
      const response = await agent
        .post("/auth/register")
        .send(testInstructor)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe("instructor");
    });

    test("Step 4: Instructor Login", async () => {
      const response = await agent
        .post("/auth/login")
        .send({
          userEmail: testInstructor.userEmail,
          password: testInstructor.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      instructorToken = response.body.data.accessToken;
      testCourse.instructorId = response.body.data.user._id;
      testQuiz.createdBy = response.body.data.user._id;
    });

    test("Step 5: Course Creation by Instructor", async () => {
      const response = await agent
        .post("/instructor/course/add")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send(testCourse)
        .expect(201);

      expect(response.body.success).toBe(true);
      courseId = response.body.data._id;
      testQuiz.courseId = courseId;
      testQuiz.lectureId = response.body.data.curriculum[0]._id;
    });

    test("Step 6: Course Enrollment by Student", async () => {
      // Get student user ID first
      const loginResponse = await agent
        .post("/auth/login")
        .send({
          userEmail: testStudent.userEmail,
          password: testStudent.password,
        })
        .expect(200);

      const studentId = loginResponse.body.data.user._id;

      const enrollmentData = {
        userId: studentId,
        userName: testStudent.userName,
        userEmail: testStudent.userEmail,
        orderStatus: "confirmed",
        paymentMethod: "card",
        paymentStatus: "completed",
        orderDate: new Date(),
        paymentId: "TEST_PAYMENT_ID",
        payerId: "TEST_PAYER_ID",
        instructorId: testCourse.instructorId,
        instructorName: testCourse.instructorName,
        courseImage: testCourse.image,
        courseTitle: testCourse.title,
        courseId: courseId,
        coursePricing: testCourse.pricing,
      };

      const response = await agent
        .post("/student/order/create")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(enrollmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test("Step 7: Quiz Creation by Instructor", async () => {
      const response = await agent
        .post("/instructor/quiz/create")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send(testQuiz)
        .expect(201);

      expect(response.body.success).toBe(true);
      quizId = response.body.data._id;
    });

    test("Step 8: Quiz Retrieval by Student", async () => {
      const response = await agent
        .get(`/student/quiz/course/${courseId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test("Step 9: Quiz Attempt Start by Student", async () => {
      const response = await agent
        .post(`/student/quiz/${quizId}/attempt`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("attemptId");
      attemptId = response.body.data.attemptId;
    });

    test("Step 10: Quiz Submission by Student", async () => {
      // First get the quiz details to get question IDs
      const quizResponse = await agent
        .get(`/student/quiz/${quizId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      const questionId = quizResponse.body.data.quiz.questions[0]._id;

      const answers = [
        {
          questionId: questionId,
          answer: "1", // Correct answer
        },
      ];

      const response = await agent
        .put(`/student/quiz/${quizId}/attempt/${attemptId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ answers })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test("Step 11: Quiz Results Retrieval by Student", async () => {
      const response = await agent
        .get(`/student/quiz/${quizId}/results`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("score");
      expect(response.body.data).toHaveProperty("passed");
      expect(response.body.data.score).toBe(100); // Should be 100% for correct answer
    });
  });
});

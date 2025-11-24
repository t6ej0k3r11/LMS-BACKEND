const mongoose = require("mongoose");
const request = require("supertest");
const { io: Client } = require("socket.io-client");

// Import your app - adjust path as needed
const app = require("../../server");

let agent;

const waitForEvent = (socket, event, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);

    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(event, handler);
  });

const connectSocketClient = (token) => {
  const baseUrl = `http://localhost:${global.__TESTPORT__}`;

  return new Promise((resolve, reject) => {
    const socket = Client(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 1,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timeout"));
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
};

const uniqueSuffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createAndLoginUser = async (userData) => {
  const registerResponse = await agent
    .post("/auth/register")
    .send(userData)
    .expect(201);

  if (userData.role === "instructor") {
    const User = require("../../models/User");
    await User.findByIdAndUpdate(registerResponse.body.data.user._id, {
      status: "approved",
    });
  }

  const loginResponse = await agent
    .post("/auth/login")
    .send({
      userEmail: userData.userEmail,
      password: userData.password,
    })
    .expect(200);

  return {
    user: registerResponse.body.data.user,
    token: loginResponse.body.data.accessToken,
  };
};

const createCourse = async (instructorToken, instructorId) => {
  const testCourse = {
    instructorId: instructorId,
    instructorName: "Test Instructor",
    date: new Date(),
    title: "Messaging Test Course",
    category: "Technology",
    level: "beginner",
    primaryLanguage: "English",
    subtitle: "Test Course Subtitle",
    description: "A test course for messaging integration testing",
    image: "https://example.com/test-image.jpg",
    welcomeMessage: "Welcome to the test course!",
    pricing: 99,
    courseType: "paid",
    objectives: "Learn messaging testing",
    students: [],
    curriculum: [
      {
        title: "Introduction",
        videoUrl: "https://example.com/test-video.mp4",
        public_id: "test-public-id",
        freePreview: true,
      },
    ],
    status: "published",
    approvalStatus: "approved",
  };

  const response = await agent
    .post("/instructor/course/add")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send(testCourse)
    .expect(201);

  return response.body.data._id;
};

const enrollStudent = async (
  studentToken,
  studentData,
  courseId,
  instructorId
) => {
  const enrollmentData = {
    userId: studentData._id,
    userName: studentData.userName,
    userEmail: studentData.userEmail,
    orderStatus: "confirmed",
    paymentMethod: "card",
    paymentStatus: "completed",
    orderDate: new Date(),
    paymentId: "TEST_PAYMENT_ID",
    payerId: "TEST_PAYER_ID",
    instructorId: instructorId,
    instructorName: "Test Instructor",
    courseImage: "https://example.com/test-image.jpg",
    courseTitle: "Messaging Test Course",
    courseId: courseId,
    coursePricing: 99,
  };

  await agent
    .post("/api/orders/create")
    .set("Authorization", `Bearer ${studentToken}`)
    .send(enrollmentData)
    .expect(201);
};

const setupMessagingScenario = async () => {
  const studentResult = await createAndLoginUser({
    userName: `teststudent_${uniqueSuffix()}`,
    userEmail: `teststudent_${uniqueSuffix()}@example.com`,
    password: "Test@123456",
    role: "student",
  });

  const instructorResult = await createAndLoginUser({
    userName: `testinstructor_${uniqueSuffix()}`,
    userEmail: `testinstructor_${uniqueSuffix()}@example.com`,
    password: "Test@123456",
    role: "instructor",
  });

  const adminResult = await createAndLoginUser({
    userName: `testadmin_${uniqueSuffix()}`,
    userEmail: `testadmin_${uniqueSuffix()}@example.com`,
    password: "Test@123456",
    role: "admin",
  });

  const createdCourseId = await createCourse(
    instructorResult.token,
    instructorResult.user._id
  );

  await enrollStudent(
    studentResult.token,
    studentResult.user,
    createdCourseId,
    instructorResult.user._id
  );

  return {
    studentToken: studentResult.token,
    studentId: studentResult.user._id,
    instructorToken: instructorResult.token,
    instructorId: instructorResult.user._id,
    adminToken: adminResult.token,
    adminId: adminResult.user._id,
    courseId: createdCourseId,
  };
};

const takeDatabaseSnapshot = async () => {
  const snapshot = {};
  const collections = mongoose.connection.collections;

  await Promise.all(
    Object.entries(collections).map(async ([name, collection]) => {
      const docs = await collection
        .find({}, { projection: { _id: 1 } })
        .toArray();

      if (!docs.length) {
        snapshot[name] = [];
        return;
      }

      snapshot[name] = await collection.find({}).toArray();
    })
  );

  return snapshot;
};

const restoreDatabaseSnapshot = async (snapshot) => {
  const collections = mongoose.connection.collections;

  for (const [name, docs] of Object.entries(snapshot)) {
    if (!docs.length || !collections[name]) continue;
    await collections[name].insertMany(docs);
  }
};

describe("Real-time Messaging System Integration Tests", () => {
  let studentToken, instructorToken, adminToken;
  let studentId, instructorId, adminId;
  let courseId;
  let studentSocket, instructorSocket, adminSocket;
  let dbSnapshot;
  let shouldRestoreSnapshot = false;

  beforeAll(async () => {
    const testPort = global.__TESTPORT__;
    agent = request.agent(`http://localhost:${testPort}`);

    ({
      studentToken,
      studentId,
      instructorToken,
      instructorId,
      adminToken,
      adminId,
      courseId,
    } = await setupMessagingScenario());

    dbSnapshot = await takeDatabaseSnapshot();
  });

  beforeEach(async () => {
    if (shouldRestoreSnapshot && dbSnapshot) {
      await restoreDatabaseSnapshot(dbSnapshot);
    } else {
      shouldRestoreSnapshot = true;
    }
  });

  afterEach(() => {
    if (studentSocket) {
      studentSocket.disconnect();
      studentSocket = null;
    }
    if (instructorSocket) {
      instructorSocket.disconnect();
      instructorSocket = null;
    }
    if (adminSocket) {
      adminSocket.disconnect();
      adminSocket = null;
    }
  });

  afterAll(() => {
    // Sockets already disconnected in afterEach; nothing else to clean up here.
  });

  describe("Messaging System Setup", () => {
    test("Setup users and course", async () => {
      expect(studentToken).toBeDefined();
      expect(instructorToken).toBeDefined();
      expect(adminToken).toBeDefined();
      expect(courseId).toBeDefined();
    });
  });

  describe("Chat Partner Management", () => {
    test("Student enrolls → instructor appears in Student Chat List", async () => {
      const response = await agent
        .get("/messages/list")
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check if instructor is in the chat partners
      const instructorPartner = response.body.data.find(
        (partner) => partner.userId === instructorId
      );
      expect(instructorPartner).toBeDefined();
      expect(instructorPartner.role).toBe("instructor");
      expect(instructorPartner.courseId).toBe(courseId);
    });

    test("Instructor can see enrolled student in chat list", async () => {
      const response = await agent
        .get("/messages/list")
        .set("Authorization", `Bearer ${instructorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check if student is in the chat partners
      const studentPartner = response.body.data.find(
        (partner) => partner.userId === studentId
      );
      expect(studentPartner).toBeDefined();
      expect(studentPartner.role).toBe("student");
      expect(studentPartner.courseId).toBe(courseId);
    });

    test("Admin can see all users in chat list", async () => {
      const response = await agent
        .get("/messages/list")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2); // At least student and instructor

      // Check if both student and instructor are in the chat partners
      const studentPartner = response.body.data.find(
        (partner) => partner.userId === studentId
      );
      const instructorPartner = response.body.data.find(
        (partner) => partner.userId === instructorId
      );

      expect(studentPartner).toBeDefined();
      expect(instructorPartner).toBeDefined();
    });
  });

  describe("Message Sending and Receiving", () => {
    test("Student sends a message → instructor receives instantly (API test)", async () => {
      const messageData = {
        receiverId: instructorId,
        courseId: courseId,
        message: "Hello Instructor!",
      };

      const response = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("_id");
      expect(response.body.data.senderId).toBe(studentId);
      expect(response.body.data.receiverId).toBe(instructorId);
      expect(response.body.data.message).toBe("Hello Instructor!");
      expect(response.body.data.courseId).toBe(courseId);
      expect(response.body.data.isSeen).toBe(false);
    });

    test("Instructor replies → student receives instantly (API test)", async () => {
      const messageData = {
        receiverId: studentId,
        courseId: courseId,
        message: "Hello Student! How can I help you?",
      };

      const response = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.senderId).toBe(instructorId);
      expect(response.body.data.receiverId).toBe(studentId);
      expect(response.body.data.message).toBe(
        "Hello Student! How can I help you?"
      );
    });

    test("Admin opens chat → can talk with both", async () => {
      // Admin sends message to student
      const messageToStudent = {
        receiverId: studentId,
        message: "Hello Student from Admin!",
      };

      const response1 = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(messageToStudent)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response1.body.data.senderId).toBe(adminId);
      expect(response1.body.data.receiverId).toBe(studentId);
      expect(response1.body.data.courseId).toBeNull(); // Admin messages don't require courseId

      // Admin sends message to instructor
      const messageToInstructor = {
        receiverId: instructorId,
        message: "Hello Instructor from Admin!",
      };

      const response2 = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(messageToInstructor)
        .expect(201);

      expect(response2.body.success).toBe(true);
      expect(response2.body.data.senderId).toBe(adminId);
      expect(response2.body.data.receiverId).toBe(instructorId);
    });
  });

  describe("Message Status and Notifications", () => {
    let messageId;

    test("Message seen status updates correctly", async () => {
      // First, send a message from student to instructor
      const messageData = {
        receiverId: instructorId,
        courseId: courseId,
        message: "Test message for seen status",
      };

      const sendResponse = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(messageData)
        .expect(201);

      messageId = sendResponse.body.data._id;

      // Instructor marks message as seen
      const markSeenResponse = await agent
        .patch("/messages/seen")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          senderId: studentId,
          courseId: courseId,
        })
        .expect(200);

      expect(markSeenResponse.body.success).toBe(true);
      expect(markSeenResponse.body.data.modifiedCount).toBeGreaterThan(0);
    });

    test("Notification badge updates across all dashboards", async () => {
      // Send a message to create a notification
      const messageData = {
        receiverId: instructorId,
        courseId: courseId,
        message: "Test notification message",
      };

      await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(messageData)
        .expect(201);

      // Check notifications endpoint
      const notificationsResponse = await agent
        .get("/notifications")
        .set("Authorization", `Bearer ${instructorToken}`)
        .expect(200);

      expect(notificationsResponse.body.success).toBe(true);
      expect(Array.isArray(notificationsResponse.body.data)).toBe(true);

      // Should have at least one message notification
      const messageNotification = notificationsResponse.body.data.find(
        (notification) => notification.category === "message"
      );
      expect(messageNotification).toBeDefined();
    });
  });

  describe("Permission Restrictions", () => {
    let otherInstructorToken, otherInstructorId, otherCourseId;

    test("Setup additional instructor and course", async () => {
      const otherInstructor = {
        userName: `otherinstructor_${Date.now()}`,
        userEmail: `otherinstructor_${Date.now()}@example.com`,
        password: "Test@123456",
        role: "instructor",
      };

      const result = await createAndLoginUser(otherInstructor);
      otherInstructorToken = result.token;
      otherInstructorId = result.user._id;

      otherCourseId = await createCourse(
        otherInstructorToken,
        otherInstructorId
      );
    });

    test("Student cannot message unrelated instructors", async () => {
      const messageData = {
        receiverId: otherInstructorId,
        courseId: otherCourseId, // Student is not enrolled in this course
        message: "Hello unrelated instructor!",
      };

      const response = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(messageData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Unauthorized to send message");
    });

    test("Instructor cannot message students from another course", async () => {
      // Enroll student in the other course first
      await enrollStudent(
        studentToken,
        {
          _id: studentId,
          userName: "teststudent",
          userEmail: "test@example.com",
        },
        otherCourseId,
        otherInstructorId
      );

      // Now try to message from the original instructor (who doesn't own the other course)
      const messageData = {
        receiverId: studentId,
        courseId: otherCourseId, // Original instructor doesn't own this course
        message: "Hello from wrong instructor!",
      };

      const response = await agent
        .post("/messages/send")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send(messageData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Unauthorized to send message");
    });
  });

  describe("Chat History and Persistence", () => {
    test("Page refresh → chat history loads correctly", async () => {
      // Get chat history between student and instructor
      const response = await agent
        .get(`/messages/${studentId}/${instructorId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .query({ courseId: courseId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("messages");
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      expect(response.body.data.messages.length).toBeGreaterThan(0);

      // Verify messages contain our test messages
      const messages = response.body.data.messages;
      const hasStudentMessage = messages.some(
        (msg) =>
          msg.senderId === studentId && msg.message.includes("Hello Instructor")
      );
      const hasInstructorMessage = messages.some(
        (msg) =>
          msg.senderId === instructorId && msg.message.includes("Hello Student")
      );

      expect(hasStudentMessage).toBe(true);
      expect(hasInstructorMessage).toBe(true);
    });

    test("Chat history pagination works", async () => {
      const response = await agent
        .get(`/messages/${studentId}/${instructorId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .query({ courseId: courseId, limit: 10, skip: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("pagination");
      expect(response.body.data.pagination).toHaveProperty("total");
      expect(response.body.data.pagination).toHaveProperty("limit", 10);
      expect(response.body.data.pagination).toHaveProperty("skip", 0);
    });
  });

  describe("Rate Limiting and Spam Prevention", () => {
    test("Rate limiting prevents spam", async () => {
      const messagePromises = [];

      for (let i = 0; i < 10; i++) {
        const messageData = {
          receiverId: instructorId,
          courseId: courseId,
          message: `Spam message ${i}`,
        };

        messagePromises.push(
          agent
            .post("/messages/send")
            .set("Authorization", `Bearer ${studentToken}`)
            .send(messageData)
        );
      }

      const responses = await Promise.all(messagePromises);

      // First 3 messages should succeed
      for (let i = 0; i < 3; i++) {
        expect(responses[i].status).toBe(201);
        expect(responses[i].body.success).toBe(true);
      }

      // Remaining messages should be rate limited (429)
      for (let i = 3; i < 10; i++) {
        expect(responses[i].status).toBe(429);
        expect(responses[i].body.success).toBe(false);
        expect(responses[i].body.message).toBe(
          "Too many messages sent; slow down."
        );
      }
    });
  });

  describe("UI Responsiveness (API-based test)", () => {
    test("Chat UI works on different screen sizes (API test)", async () => {
      // This is primarily a frontend test, but we can verify the API works
      // which supports the UI functionality

      const response = await agent
        .get("/messages/list")
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Verify the data structure supports UI rendering
      expect(response.body.data[0]).toHaveProperty("userId");
      expect(response.body.data[0]).toHaveProperty("userName");
      expect(response.body.data[0]).toHaveProperty("role");
    });
  });

  describe("Socket Connection Management", () => {
    test("Token expiry simulation (API test)", async () => {
      // This would require JWT token manipulation
      // For now, test that invalid tokens are rejected
      const invalidToken = "invalid.jwt.token";

      const response = await agent
        .get("/messages/list")
        .set("Authorization", `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Socket Real-time Messaging", () => {
    beforeEach(async () => {
      studentSocket = await connectSocketClient(studentToken);
      instructorSocket = await connectSocketClient(instructorToken);
      adminSocket = await connectSocketClient(adminToken);
    });

    test("Student socket sends a message → instructor receives instantly", async () => {
      const payload = {
        receiverId: instructorId,
        courseId,
        message: "Socket hello instructor",
      };

      const receivedPromise = waitForEvent(instructorSocket, "receive_message");
      studentSocket.emit("send_message", payload);
      const received = await receivedPromise;

      expect(received.senderId).toBe(studentId);
      expect(received.receiverId).toBe(instructorId);
      expect(received.message).toBe(payload.message);
    });

    test("Instructor replies via socket → student receives instantly", async () => {
      const payload = {
        receiverId: studentId,
        courseId,
        message: "Socket hello student",
      };

      const receivedPromise = waitForEvent(studentSocket, "receive_message");
      instructorSocket.emit("send_message", payload);
      const received = await receivedPromise;

      expect(received.senderId).toBe(instructorId);
      expect(received.receiverId).toBe(studentId);
      expect(received.message).toBe(payload.message);
    });

    test("Admin socket can message both student and instructor", async () => {
      const toStudent = {
        receiverId: studentId,
        message: "Admin → Student via socket",
      };

      const toInstructor = {
        receiverId: instructorId,
        message: "Admin → Instructor via socket",
      };

      const studentPromise = waitForEvent(studentSocket, "receive_message");
      const instructorPromise = waitForEvent(instructorSocket, "receive_message");

      adminSocket.emit("send_message", toStudent);
      adminSocket.emit("send_message", toInstructor);

      const [studentMsg, instructorMsg] = await Promise.all([
        studentPromise,
        instructorPromise,
      ]);

      expect(studentMsg.senderId).toBe(adminId);
      expect(instructorMsg.senderId).toBe(adminId);
    });

    test("messages_seen socket event updates receivers", async () => {
      // Student sends message first
      studentSocket.emit("send_message", {
        receiverId: instructorId,
        courseId,
        message: "Seen status socket test",
      });

      const received = await waitForEvent(instructorSocket, "receive_message");

      const seenPromise = waitForEvent(instructorSocket, "messages_seen");
      instructorSocket.emit("mark_seen", {
        senderId: studentId,
        courseId,
      });

      const seenPayload = await seenPromise;
      expect(seenPayload.modifiedCount).toBeGreaterThan(0);
      expect(received.receiverId).toBe(instructorId);
    });

    test("Invalid/expired token disconnects socket during auth", async () => {
      await expect(connectSocketClient("invalid.token.value")).rejects.toBeTruthy();
    });

    test("No duplicate messages emitted when client retries with last message id", async () => {
      const payload = {
        receiverId: instructorId,
        courseId,
        message: "Deduplication test",
      };

      const firstMessage = await (async () => {
        const promise = waitForEvent(instructorSocket, "receive_message");
        studentSocket.emit("send_message", payload);
        return promise;
      })();

      expect(firstMessage.message).toBe(payload.message);

      const duplicateAttempt = new Promise(async (resolve, reject) => {
        const handler = () => {
          instructorSocket.off("receive_message", handler);
          reject(new Error("Duplicate message received"));
        };

        instructorSocket.once("receive_message", handler);

        studentSocket.emit("send_message", {
          ...payload,
          _id: firstMessage._id,
        });

        setTimeout(() => {
          instructorSocket.off("receive_message", handler);
          resolve(true);
        }, 800);
      });

      await expect(duplicateAttempt).resolves.toBe(true);
    });
  });
});

const paypal = require("../../helpers/paypal");
const Order = require("../../models/Order");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");

const createOrder = async (req, res) => {
  try {
    const { courseId, paymentConfirmed } = req.body;
    const studentId = req.user._id;
    const userName = req.user.userName;
    const userEmail = req.user.userEmail;

    // Fetch course from DB for validation
    const course = await Course.findById(courseId).populate(
      "prerequisites",
      "title _id"
    );
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check course status and approval
    if (course.status !== "published" || course.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Course not available for enrollment",
      });
    }

    // Check prerequisites
    if (course.prerequisites && course.prerequisites.length > 0) {
      const studentCourses = await StudentCourses.findOne({
        userId: studentId,
      });
      const CourseProgress = require("../../models/CourseProgress");

      const missingPrerequisites = [];

      for (const prereq of course.prerequisites) {
        const isEnrolled = studentCourses?.courses?.some(
          (c) => c.courseId === prereq._id.toString()
        );
        if (!isEnrolled) {
          missingPrerequisites.push(prereq.title);
          continue;
        }

        // Check if completed
        const progress = await CourseProgress.findOne({
          userId: studentId,
          courseId: prereq._id.toString(),
        });

        if (!progress || !progress.completed) {
          missingPrerequisites.push(prereq.title);
        }
      }

      if (missingPrerequisites.length > 0) {
        return res.status(400).json({
          success: false,
          message: `You must complete these prerequisite courses before enrolling: ${missingPrerequisites.join(
            ", "
          )}`,
        });
      }
    }

    const isFreeCourse = course.pricing === 0;

    // Check if student already enrolled
    const existingStudentCourses = await StudentCourses.findOne({
      userId: studentId,
    });
    const alreadyEnrolled = existingStudentCourses?.courses?.some(
      (c) => c.courseId === courseId
    );
    if (alreadyEnrolled) {
      return res.status(400).json({
        success: false,
        message: "Already enrolled",
      });
    }

    if (!isFreeCourse) {
      if (!paymentConfirmed) {
        return res.status(400).json({
          success: false,
          message: "Payment required",
        });
      }
    }

    // Log enrollment attempt for auditing
    console.log(
      `Enrollment attempt for course ${courseId} by user ${studentId}`
    );

    // Use validated course data
    const instructorId = course.instructorId;
    const instructorName = course.instructorName;
    const courseTitle = course.title;
    const courseImage = course.image;
    const coursePricing = course.pricing;

    // For free courses, directly enroll
    if (isFreeCourse) {
      const orderDate = new Date();
      const newlyCreatedCourseOrder = new Order({
        userId: studentId,
        userName,
        userEmail,
        orderStatus: "confirmed",
        paymentMethod: "free",
        paymentStatus: "completed",
        orderDate,
        paymentId: "FREE_ENROLLMENT",
        payerId: "FREE_ENROLLMENT",
        instructorId,
        instructorName,
        courseImage,
        courseTitle,
        courseId,
        coursePricing,
      });

      await newlyCreatedCourseOrder.save();

      // Directly enroll the student
      let studentCourses = await StudentCourses.findOne({
        userId: studentId,
      });

      if (studentCourses) {
        studentCourses.courses.push({
          courseId,
          title: courseTitle,
          instructorId,
          instructorName,
          dateOfPurchase: orderDate,
          courseImage,
        });

        await studentCourses.save();
      } else {
        const newStudentCourses = new StudentCourses({
          userId: studentId,
          courses: [
            {
              courseId,
              title: courseTitle,
              instructorId,
              instructorName,
              dateOfPurchase: orderDate,
              courseImage,
            },
          ],
        });

        await newStudentCourses.save();
      }

      // Update the course schema students
      await Course.findByIdAndUpdate(courseId, {
        $addToSet: {
          students: {
            studentId,
            studentName: userName,
            studentEmail: userEmail,
            paidAmount: 0,
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          approveUrl: null,
          orderId: newlyCreatedCourseOrder._id,
        },
        message: "Successfully enrolled in free course!",
      });
    }

    // For paid courses, simulate payment
    const orderDate = new Date();
    const newlyCreatedCourseOrder = new Order({
      userId: studentId,
      userName,
      userEmail,
      orderStatus: "confirmed",
      paymentMethod: "paypal",
      paymentStatus: "completed",
      orderDate,
      paymentId: "SIMULATED_PAYMENT",
      payerId: "SIMULATED_PAYER",
      instructorId,
      instructorName,
      courseImage,
      courseTitle,
      courseId,
      coursePricing,
    });

    await newlyCreatedCourseOrder.save();

    // Directly enroll the student
    let studentCourses = await StudentCourses.findOne({
      userId: studentId,
    });

    if (studentCourses) {
      studentCourses.courses.push({
        courseId,
        title: courseTitle,
        instructorId,
        instructorName,
        dateOfPurchase: orderDate,
        courseImage,
      });

      await studentCourses.save();
    } else {
      const newStudentCourses = new StudentCourses({
        userId: studentId,
        courses: [
          {
            courseId,
            title: courseTitle,
            instructorId,
            instructorName,
            dateOfPurchase: orderDate,
            courseImage,
          },
        ],
      });

      await newStudentCourses.save();
    }

    // Update the course schema students
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: {
        students: {
          studentId,
          studentName: userName,
          studentEmail: userEmail,
          paidAmount: coursePricing,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        approveUrl: null,
        orderId: newlyCreatedCourseOrder._id,
      },
      message: "Successfully enrolled in paid course!",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const capturePaymentAndFinalizeOrder = async (req, res) => {
  try {
    const { paymentId, payerId, orderId } = req.body;

    let order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order can not be found",
      });
    }

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.paymentId = paymentId;
    order.payerId = payerId;

    await order.save();

    //update out student course model
    const studentCourses = await StudentCourses.findOne({
      userId: order.userId,
    });

    if (studentCourses) {
      studentCourses.courses.push({
        courseId: order.courseId,
        title: order.courseTitle,
        instructorId: order.instructorId,
        instructorName: order.instructorName,
        dateOfPurchase: order.orderDate,
        courseImage: order.courseImage,
      });

      await studentCourses.save();
    } else {
      const newStudentCourses = new StudentCourses({
        userId: order.userId,
        courses: [
          {
            courseId: order.courseId,
            title: order.courseTitle,
            instructorId: order.instructorId,
            instructorName: order.instructorName,
            dateOfPurchase: order.orderDate,
            courseImage: order.courseImage,
          },
        ],
      });

      await newStudentCourses.save();
    }

    //update the course schema students
    await Course.findByIdAndUpdate(order.courseId, {
      $addToSet: {
        students: {
          studentId: order.userId,
          studentName: order.userName,
          studentEmail: order.userEmail,
          paidAmount: order.coursePricing,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Order confirmed",
      data: order,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

module.exports = { createOrder, capturePaymentAndFinalizeOrder };

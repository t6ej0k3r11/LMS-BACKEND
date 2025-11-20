const paypal = require("../../helpers/paypal");
const Order = require("../../models/Order");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");

const createOrder = async (req, res) => {
  try {
    const {
      userId,
      userName,
      userEmail,
      orderStatus,
      paymentMethod,
      paymentStatus,
      orderDate,
      paymentId,
      payerId,
      courseId,
      coursePricing,
    } = req.body;
    // Fetch course from DB for validation
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const isFreeCourse = course.pricing === 0;

    if (!isFreeCourse) {
      if (course.pricing !== coursePricing) {
        return res.status(400).json({ message: "Invalid course price" });
      }
      // Verify payment status (simulated for this implementation)
      const paymentConfirmed = true; // Assuming simulated payment is confirmed
      if (!paymentConfirmed) {
        return res.status(402).json({ message: "Payment required" });
      }
    } else {
      if (coursePricing !== 0) {
        return res
          .status(400)
          .json({ message: "Invalid course price for free course" });
      }
    }

    // Log enrollment attempt for auditing
    console.log(`Enrollment attempt for course ${courseId} by user ${userId}`);

    // Use validated course data
    const instructorId = course.instructorId;
    const instructorName = course.instructorName;
    const courseTitle = course.title;
    const courseImage = course.image;

    // Check if user has already completed this course (for paid courses only)
    const studentCourses = await StudentCourses.findOne({ userId });
    const enrolledCourse = studentCourses?.courses?.find(
      (course) => course.courseId === courseId
    );
    if (enrolledCourse && course.pricing > 0) {
      const CourseProgress = require("../../models/CourseProgress");
      const progress = await CourseProgress.findOne({
        userId,
        courseId,
      });
      if (progress && progress.isCompleted) {
        return res.status(400).json({
          success: false,
          message: "You have already completed this course.",
        });
      }
      // For paid courses, allow re-enrollment if not completed
    }
    // For free courses, allow enrollment even if completed

    // For free courses, skip PayPal and directly enroll
    if (isFreeCourse) {
      const newlyCreatedCourseOrder = new Order({
        userId,
        userName,
        userEmail,
        orderStatus: "confirmed",
        paymentMethod,
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
      const studentCourses = await StudentCourses.findOne({
        userId: userId,
      });

      if (studentCourses) {
        studentCourses.courses.push({
          courseId: courseId,
          title: courseTitle,
          instructorId: instructorId,
          instructorName: instructorName,
          dateOfPurchase: orderDate,
          courseImage: courseImage,
        });

        await studentCourses.save();
      } else {
        const newStudentCourses = new StudentCourses({
          userId: userId,
          courses: [
            {
              courseId: courseId,
              title: courseTitle,
              instructorId: instructorId,
              instructorName: instructorName,
              dateOfPurchase: orderDate,
              courseImage: courseImage,
            },
          ],
        });

        await newStudentCourses.save();
      }

      // Update the course schema students
      await Course.findByIdAndUpdate(courseId, {
        $addToSet: {
          students: {
            studentId: userId,
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

    // For paid courses, simulate payment without PayPal
    const newlyCreatedCourseOrder = new Order({
      userId,
      userName,
      userEmail,
      orderStatus: "confirmed",
      paymentMethod,
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
    let studentCoursesPaid = await StudentCourses.findOne({
      userId: userId,
    });

    if (studentCoursesPaid) {
      studentCoursesPaid.courses.push({
        courseId: courseId,
        title: courseTitle,
        instructorId: instructorId,
        instructorName: instructorName,
        dateOfPurchase: orderDate,
        courseImage: courseImage,
      });

      await studentCoursesPaid.save();
    } else {
      const newStudentCoursesPaid = new StudentCourses({
        userId: userId,
        courses: [
          {
            courseId: courseId,
            title: courseTitle,
            instructorId: instructorId,
            instructorName: instructorName,
            dateOfPurchase: orderDate,
            courseImage: courseImage,
          },
        ],
      });

      await newStudentCoursesPaid.save();
    }

    // Update the course schema students
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: {
        students: {
          studentId: userId,
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

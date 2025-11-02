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
      instructorId,
      instructorName,
      courseImage,
      courseTitle,
      courseId,
      coursePricing,
    } = req.body;

    // Check if user is already enrolled and not completed
    const studentCourses = await StudentCourses.findOne({ userId });
    const enrolledCourse = studentCourses?.courses?.find(
      (course) => course.courseId === courseId
    );
    if (enrolledCourse) {
      const CourseProgress = require("../../models/CourseProgress");
      const progress = await CourseProgress.findOne({
        userId,
        courseId,
      });
      const completed = progress?.completed || false;
      if (!completed) {
        return res.status(400).json({
          success: false,
          message: "You are already enrolled in this course.",
        });
      }
      // If completed, allow re-enrollment
    }

    // For free courses, skip PayPal and directly enroll
    if (paymentMethod === "free" && coursePricing === 0) {
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

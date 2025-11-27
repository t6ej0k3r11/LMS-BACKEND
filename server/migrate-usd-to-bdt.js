const mongoose = require("mongoose");
const Course = require("./models/Course");
const Payment = require("./models/Payment");
const Transaction = require("./models/Transaction");
const Payout = require("./models/Payout");
const Order = require("./models/Order");
const StudentCourses = require("./models/StudentCourses");

// Conversion rate: 1 USD = 120 BDT
const CONVERSION_RATE = 120;

async function migrateToBDT() {
  try {
    console.log("Starting USD to BDT migration...");

    // 1. Update Course pricing
    console.log("Updating Course pricing...");
    const courses = await Course.find({});
    for (const course of courses) {
      if (course.pricing && course.pricing > 0) {
        const newPricing = course.pricing * CONVERSION_RATE;
        await Course.findByIdAndUpdate(course._id, { pricing: newPricing });
        console.log(
          `Updated course ${course.title}: ${course.pricing} -> ${newPricing}`
        );
      }
    }

    // 2. Update Payment amounts
    console.log("Updating Payment amounts...");
    const payments = await Payment.find({});
    for (const payment of payments) {
      if (payment.amount && payment.amount > 0) {
        const newAmount = payment.amount * CONVERSION_RATE;
        await Payment.findByIdAndUpdate(payment._id, { amount: newAmount });
        console.log(
          `Updated payment ${payment._id}: ${payment.amount} -> ${newAmount}`
        );
      }
    }

    // 3. Update Transaction amounts
    console.log("Updating Transaction amounts...");
    const transactions = await Transaction.find({});
    for (const transaction of transactions) {
      const updates = {};
      if (transaction.amount && transaction.amount > 0) {
        updates.amount = transaction.amount * CONVERSION_RATE;
      }
      if (
        transaction.platformCommission &&
        transaction.platformCommission > 0
      ) {
        updates.platformCommission =
          transaction.platformCommission * CONVERSION_RATE;
      }
      if (
        transaction.instructorEarnings &&
        transaction.instructorEarnings > 0
      ) {
        updates.instructorEarnings =
          transaction.instructorEarnings * CONVERSION_RATE;
      }
      if (Object.keys(updates).length > 0) {
        await Transaction.findByIdAndUpdate(transaction._id, updates);
        console.log(
          `Updated transaction ${transaction._id}: ${JSON.stringify(updates)}`
        );
      }
    }

    // 4. Update Payout amounts
    console.log("Updating Payout amounts...");
    const payouts = await Payout.find({});
    for (const payout of payouts) {
      if (payout.amount && payout.amount > 0) {
        const newAmount = payout.amount * CONVERSION_RATE;
        await Payout.findByIdAndUpdate(payout._id, { amount: newAmount });
        console.log(
          `Updated payout ${payout._id}: ${payout.amount} -> ${newAmount}`
        );
      }
    }

    // 5. Update Order coursePricing
    console.log("Updating Order coursePricing...");
    const orders = await Order.find({});
    for (const order of orders) {
      if (order.coursePricing && order.coursePricing > 0) {
        const newPricing = order.coursePricing * CONVERSION_RATE;
        await Order.findByIdAndUpdate(order._id, { coursePricing: newPricing });
        console.log(
          `Updated order ${order._id}: ${order.coursePricing} -> ${newPricing}`
        );
      }
    }

    // 6. Update StudentCourses paidAmount in Course.students array
    console.log("Updating Course.students paidAmount...");
    const coursesWithStudents = await Course.find({
      "students.paidAmount": { $exists: true },
    });
    for (const course of coursesWithStudents) {
      const updatedStudents = course.students.map((student) => {
        if (student.paidAmount && student.paidAmount > 0) {
          const newPaidAmount = student.paidAmount * CONVERSION_RATE;
          console.log(
            `Updated student ${student.studentId} in course ${course.title}: ${student.paidAmount} -> ${newPaidAmount}`
          );
          return {
            ...student.toObject(),
            paidAmount: newPaidAmount.toString(),
          };
        }
        return student;
      });
      await Course.findByIdAndUpdate(course._id, { students: updatedStudents });
    }

    console.log("Migration completed successfully!");
    console.log(`Conversion rate used: 1 USD = ${CONVERSION_RATE} BDT`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Connect to database and run migration
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/lms";

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    return migrateToBDT();
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });

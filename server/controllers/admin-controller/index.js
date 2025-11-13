const User = require("../../models/User");
const Course = require("../../models/Course");
const AuditLog = require("../../models/AuditLog");

// Helper function to log admin actions
const logAdminAction = async (
  adminId,
  adminName,
  action,
  targetType,
  targetId,
  targetName,
  details,
  req
) => {
  try {
    await AuditLog.create({
      adminId,
      adminName,
      action,
      targetType,
      targetId,
      targetName,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};

// Get all users with pagination and filtering
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, status = "all" } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (role && role !== "all") filter.role = role;
    if (status && status !== "all") filter.status = status;
    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// Update user details
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userName, userEmail, role, status } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldData = {
      userName: user.userName,
      userEmail: user.userEmail,
      role: user.role,
      status: user.status,
    };

    user.userName = userName || user.userName;
    user.userEmail = userEmail || user.userEmail;
    user.role = role || user.role;
    user.status = status || user.status;

    await user.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_updated",
      "user",
      userId,
      user.userName,
      { oldData, newData: { userName, userEmail, role, status } },
      req
    );

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        _id: user._id,
        userName: user.userName,
        userEmail: user.userEmail,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting admin users
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    await User.findByIdAndDelete(userId);

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_deleted",
      "user",
      userId,
      user.userName,
      {
        deletedUser: {
          userName: user.userName,
          userEmail: user.userEmail,
          role: user.role,
        },
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

// Bulk user operations
const bulkUserAction = async (req, res) => {
  try {
    const { userIds, action, newRole } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    let updateData = {};
    let logAction = "";

    switch (action) {
      case "change_role":
        if (!newRole || !["student", "instructor"].includes(newRole)) {
          return res.status(400).json({
            success: false,
            message: "Valid new role is required",
          });
        }
        updateData.role = newRole;
        logAction = "bulk_user_action";
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: "admin" } }, // Prevent modifying admin users
      updateData
    );

    // Log the bulk action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      logAction,
      "user",
      "bulk",
      `${userIds.length} users`,
      { action, newRole, affectedCount: result.modifiedCount },
      req
    );

    res.status(200).json({
      success: true,
      message: `Bulk action completed. ${result.modifiedCount} users affected.`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Bulk user action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk action",
    });
  }
};

// Get courses pending approval
const getPendingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const courses = await Course.find({ approvalStatus: "pending" })
      .populate("instructorId", "userName userEmail")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Course.countDocuments({ approvalStatus: "pending" });

    res.status(200).json({
      success: true,
      data: {
        courses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourses: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get pending courses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending courses",
    });
  }
};

// Approve or reject course
const reviewCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'approve' or 'reject'",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Course has already been reviewed",
      });
    }

    const oldStatus = course.approvalStatus;
    course.approvalStatus = action === "approve" ? "approved" : "rejected";
    course.approvalDate = new Date();
    course.approvedBy = req.user._id;

    if (action === "reject") {
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }
      course.rejectionReason = rejectionReason;
    }

    await course.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      action === "approve" ? "course_approved" : "course_rejected",
      "course",
      courseId,
      course.title,
      {
        oldStatus,
        newStatus: course.approvalStatus,
        rejectionReason: action === "reject" ? rejectionReason : null,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: `Course ${action}d successfully`,
      data: {
        courseId,
        approvalStatus: course.approvalStatus,
        approvalDate: course.approvalDate,
        rejectionReason: course.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Review course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review course",
    });
  }
};

// Get audit logs
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      adminId,
      startDate,
      endDate,
    } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (action) filter.action = action;
    if (adminId) filter.adminId = adminId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalLogs: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
};

// Deactivate user
const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot deactivate admin users",
      });
    }

    if (user.status === "inactive") {
      return res.status(400).json({
        success: false,
        message: "User is already inactive",
      });
    }

    const oldStatus = user.status;
    user.status = "inactive";
    await user.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_deactivated",
      "user",
      userId,
      user.userName,
      { oldStatus, newStatus: "inactive" },
      req
    );

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: {
        _id: user._id,
        userName: user.userName,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate user",
    });
  }
};

// Reactivate user
const reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status === "active") {
      return res.status(400).json({
        success: false,
        message: "User is already active",
      });
    }

    const oldStatus = user.status;
    user.status = "active";
    await user.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_reactivated",
      "user",
      userId,
      user.userName,
      { oldStatus, newStatus: "active" },
      req
    );

    res.status(200).json({
      success: true,
      message: "User reactivated successfully",
      data: {
        _id: user._id,
        userName: user.userName,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Reactivate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reactivate user",
    });
  }
};

// Get admin dashboard stats
const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCourses = await Course.countDocuments();
    const pendingCourses = await Course.countDocuments({
      approvalStatus: "pending",
    });
    const totalAdmins = await User.countDocuments({ role: "admin" });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCourses,
        pendingCourses,
        totalAdmins,
      },
    });
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin stats",
    });
  }
};

// Get recent activities from audit logs
const getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const activities = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("adminId", "userName");

    res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Get recent activities error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activities",
    });
  }
};

module.exports = {
  getAllUsers,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
  bulkUserAction,
  getPendingCourses,
  reviewCourse,
  getAuditLogs,
  getAdminStats,
  getRecentActivities,
};

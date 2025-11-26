const User = require("../../models/User");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");
const Order = require("../../models/Order");

// Get user profile data
const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user data
    const user = await User.findById(userId).select("-password -refreshTokens");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get role-specific data
    let roleData = {};

    switch (user.role) {
      case "student":
        // Get enrolled courses count
        const enrolledCourses = await StudentCourses.countDocuments({
          studentId: userId,
          enrollmentStatus: "enrolled",
        });

        // Get completed courses count
        const completedCourses = await StudentCourses.countDocuments({
          studentId: userId,
          completionStatus: "completed",
        });

        // Get certificates count (assuming certificates are stored somewhere)
        const certificates = await StudentCourses.countDocuments({
          studentId: userId,
          certificateIssued: true,
        });

        // Calculate progress (simplified)
        const totalEnrolled = enrolledCourses || 1;
        const progress = Math.round((completedCourses / totalEnrolled) * 100);

        roleData = {
          enrolledCourses,
          completedCourses,
          certificates,
          progress: Math.min(progress, 100),
        };
        break;

      case "instructor":
        // Get courses created count
        const coursesCreated = await Course.countDocuments({
          instructorId: userId,
        });

        // Get total students across all courses
        const instructorCourses = await Course.find({
          instructorId: userId,
        }).select("_id");

        const courseIds = instructorCourses.map((course) => course._id);
        const totalStudents = await StudentCourses.countDocuments({
          courseId: { $in: courseIds },
          enrollmentStatus: "enrolled",
        });

        // Get earnings (simplified - sum of order amounts for instructor's courses)
        const earnings = await Order.aggregate([
          {
            $lookup: {
              from: "studentcourses",
              localField: "courseId",
              foreignField: "courseId",
              as: "enrollments",
            },
          },
          {
            $match: {
              "enrollments.studentId": { $exists: true },
            },
          },
          {
            $lookup: {
              from: "courses",
              localField: "courseId",
              foreignField: "_id",
              as: "course",
            },
          },
          {
            $match: {
              "course.instructorId": userId,
            },
          },
          {
            $group: {
              _id: null,
              totalEarnings: { $sum: "$amount" },
            },
          },
        ]);

        roleData = {
          coursesCreated,
          totalStudents,
          earnings: earnings.length > 0 ? earnings[0].totalEarnings : 0,
        };
        break;

      case "admin":
        // Get system stats
        const totalUsers = await User.countDocuments();
        const totalCourses = await Course.countDocuments();
        const activeUsers = await User.countDocuments({ status: "active" });

        roleData = {
          totalUsers,
          totalCourses,
          activeUsers,
          systemHealth: "Good", // Could be more sophisticated
        };
        break;
    }

    res.status(200).json({
      success: true,
      message: "Profile data retrieved successfully",
      data: {
        user,
        roleData,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile data",
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      fullName,
      phone,
      bio,
      location,
      website,
      linkedin,
      github,
      avatar,
    } = req.body;

    // Validate URLs if provided
    const urlFields = { website, linkedin, github };
    for (const [field, value] of Object.entries(urlFields)) {
      if (value && !isValidUrl(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field} URL format`,
        });
      }
    }

    // Update user data
    const updateData = {};
    if (fullName) updateData.userName = fullName;
    if (phone) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (location) updateData.location = location;
    if (website) updateData.website = website;
    if (linkedin) updateData.linkedin = linkedin;
    if (github) updateData.github = github;
    if (avatar) updateData.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -refreshTokens");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { preferences } = req.body;

    // Validate preferences structure
    const validPreferences = [
      "emailNotifications",
      "pushNotifications",
      "courseUpdates",
      "marketingEmails",
    ];

    const updateData = {};
    for (const pref of validPreferences) {
      if (preferences.hasOwnProperty(pref)) {
        updateData[`preferences.${pref}`] = Boolean(preferences[pref]);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -refreshTokens");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: {
        preferences: updatedUser.preferences || {},
      },
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification preferences",
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "New password does not meet security requirements",
        errors: passwordValidation.errors.map((error) => ({
          field: "newPassword",
          message: error,
        })),
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

// Delete account (soft delete - mark as inactive)
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user has active courses/enrollments (for instructors/students)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // For instructors, check if they have active courses
    if (user.role === "instructor") {
      const activeCourses = await Course.countDocuments({
        instructorId: userId,
        status: "published",
      });

      if (activeCourses > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete account with active courses. Please unpublish all courses first.",
        });
      }
    }

    // Mark user as inactive instead of deleting
    await User.findByIdAndUpdate(userId, {
      status: "inactive",
      deletedAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};

// Helper function to validate URLs
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Password strength validation (same as in auth controller)
const validatePasswordStrength = (password) => {
  const errors = [];

  // Length check
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(
    Boolean
  ).length;
  if (varietyCount < 4) {
    errors.push(
      "Password must include uppercase, lowercase, digits, and special characters (@$!%*?&)"
    );
  }

  // Avoid common patterns
  const repeatedChars = /(.)\1{2,}/.test(password);
  if (repeatedChars) {
    errors.push("Password should not contain repeated characters");
  }

  // Basic dictionary word check
  const commonWords = [
    "password",
    "123456",
    "qwerty",
    "admin",
    "user",
    "login",
  ];
  const lowerPassword = password.toLowerCase();
  const hasCommonWord = commonWords.some((word) =>
    lowerPassword.includes(word)
  );
  if (hasCommonWord) {
    errors.push("Password should not contain common words");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  getProfile,
  updateProfile,
  updateNotificationPreferences,
  changePassword,
  deleteAccount,
};

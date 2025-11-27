const User = require("../../models/User");

// Get current user settings
const getUserSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("-password -refreshTokens");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return role-specific settings
    const baseSettings = {
      name: user.userName,
      email: user.userEmail,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      preferences: user.preferences,
    };

    let roleSpecificSettings = {};

    switch (user.role) {
      case "student":
        roleSpecificSettings = {
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          address: user.location,
          languagePreference: user.languagePreference,
        };
        break;

      case "instructor":
        roleSpecificSettings = {
          bio: user.bio,
          expertise: user.expertise,
          socialLinks: {
            linkedin: user.linkedin,
            github: user.github,
            youtube: user.youtube,
            facebook: user.facebook,
          },
          coverImage: user.coverImage,
          payout: user.payoutDetails,
        };
        break;

      case "admin":
        // Admins have no additional settings beyond base
        break;
    }

    res.status(200).json({
      success: true,
      message: "Settings retrieved successfully",
      data: {
        ...baseSettings,
        ...roleSpecificSettings,
      },
    });
  } catch (error) {
    console.error("Get user settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve settings",
    });
  }
};

// Update user settings
const updateUserSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate and filter fields based on role
    const allowedFields = {
      student: [
        "name",
        "phone",
        "gender",
        "dateOfBirth",
        "address",
        "languagePreference",
        "notifications",
      ],
      instructor: [
        "name",
        "phone",
        "bio",
        "expertise",
        "socialLinks",
        "notifications",
        "payout",
      ],
      admin: ["name", "phone", "notifications"],
    };

    const roleFields = allowedFields[user.role] || [];
    const filteredData = {};

    // Process each field
    for (const [key, value] of Object.entries(updateData)) {
      if (!roleFields.includes(key)) {
        return res.status(400).json({
          success: false,
          message: `Field '${key}' is not allowed for ${user.role} role`,
        });
      }

      // Map frontend field names to database field names
      switch (key) {
        case "name":
          if (value && typeof value === "string" && value.trim().length >= 3) {
            filteredData.userName = value.trim();
          } else {
            return res.status(400).json({
              success: false,
              message: "Name must be at least 3 characters long",
            });
          }
          break;

        case "phone":
          if (
            value &&
            !/^\+?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-()]/g, ""))
          ) {
            return res.status(400).json({
              success: false,
              message: "Please enter a valid phone number",
            });
          }
          filteredData.phone = value || null;
          break;

        case "gender":
          if (
            user.role === "student" &&
            value &&
            !["male", "female", "other", "prefer-not-to-say"].includes(value)
          ) {
            return res.status(400).json({
              success: false,
              message: "Invalid gender value",
            });
          }
          filteredData.gender = value || null;
          break;

        case "dateOfBirth":
          if (user.role === "student" && value) {
            const dob = new Date(value);
            if (isNaN(dob.getTime())) {
              return res.status(400).json({
                success: false,
                message: "Invalid date of birth",
              });
            }
            filteredData.dateOfBirth = dob;
          }
          break;

        case "address":
          if (user.role === "student") {
            filteredData.location = value || null;
          }
          break;

        case "languagePreference":
          if (user.role === "student") {
            filteredData.languagePreference = value || "en";
          }
          break;

        case "bio":
          if (user.role === "instructor") {
            filteredData.bio = value || null;
          }
          break;

        case "expertise":
          if (user.role === "instructor") {
            filteredData.expertise = value || null;
          }
          break;

        case "socialLinks":
          if (
            user.role === "instructor" &&
            value &&
            typeof value === "object"
          ) {
            if (value.linkedin) filteredData.linkedin = value.linkedin;
            if (value.github) filteredData.github = value.github;
            if (value.youtube) filteredData.youtube = value.youtube;
            if (value.facebook) filteredData.facebook = value.facebook;
          }
          break;

        case "notifications":
          if (value && typeof value === "object") {
            if (value.email !== undefined)
              filteredData["preferences.emailNotifications"] = Boolean(
                value.email
              );
            if (value.push !== undefined)
              filteredData["preferences.pushNotifications"] = Boolean(
                value.push
              );
          }
          break;

        case "payout":
          if (
            user.role === "instructor" &&
            value &&
            typeof value === "object"
          ) {
            if (
              value.method &&
              !["bkash", "nagad", "bank"].includes(value.method)
            ) {
              return res.status(400).json({
                success: false,
                message: "Invalid payout method",
              });
            }
            filteredData.payoutDetails = {
              method: value.method || null,
              number: value.number || null,
              accountHolder: value.accountHolder || null,
            };
          }
          break;
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, filteredData, {
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
      message: "Settings updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user settings error:", error);

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
      message: "Failed to update settings",
    });
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    const userId = req.user._id;

    // File validation is handled by multer middleware
    const result =
      await require("../../helpers/cloudinary").uploadMediaToCloudinary(
        req.file.path
      );

    // Update user's avatar
    await User.findByIdAndUpdate(userId, { avatar: result.secure_url });

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
    });
  }
};

// Upload cover image (instructor only)
const uploadCoverImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.role !== "instructor") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can upload cover images",
      });
    }

    const result =
      await require("../../helpers/cloudinary").uploadMediaToCloudinary(
        req.file.path
      );

    // Update user's cover image
    await User.findByIdAndUpdate(userId, { coverImage: result.secure_url });

    res.status(200).json({
      success: true,
      message: "Cover image uploaded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Upload cover image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload cover image",
    });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings,
  uploadProfilePicture,
  uploadCoverImage,
};

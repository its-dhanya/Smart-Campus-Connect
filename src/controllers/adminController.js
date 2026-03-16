const Student = require('../models/Student');
const bcrypt = require('bcryptjs');

// Create a new user (Student) with specified role - SUPER_ADMIN only
const createUser = async (req, res) => {
    try {
        const { email, password, name, rollNo, department, semester, hostelBlock, role } = req.body;

        // Check if user already exists
        const existingUser = await Student.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = new Student({
            email,
            password: hashedPassword,
            name,
            rollNo,
            department,
            semester,
            hostelBlock,
            role: role || 'STUDENT'
        });

        await newUser.save();

        res.status(201).json({ message: `User created with email ${email}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

// Get all users - SUPER_ADMIN only
const getAllUsers = async (req, res) => {
    try {
        const users = await Student.find({}, '-password'); // Exclude password
        res.status(200).json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

// Get user by ID - SUPER_ADMIN only
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Student.findById(id, '-password');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

// Update user - SUPER_ADMIN only
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Hash password if provided
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        const updatedUser = await Student.findByIdAndUpdate(id, updates, { new: true, select: '-password' });
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User updated", user: updatedUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

// Delete user - SUPER_ADMIN only
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await Student.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "User deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

// Placeholder for system stats
const getStats = async (req, res) => {
    // Implement stats logic here
    res.json({ message: 'Get system statistics' });
};

// Placeholder for queue status
const getQueueStatus = async (req, res) => {
    // Implement queue status logic here
    res.json({ message: 'Get queue status' });
};

// Placeholder for resend notifications
const resendNotifications = async (req, res) => {
    // Implement resend logic here
    res.json({ message: 'Resend notifications' });
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getStats,
    getQueueStatus,
    resendNotifications
};
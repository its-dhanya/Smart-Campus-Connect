const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const Student = require("../models/Student")

const createDefaultAdmin = async () => {
    try {
        const existingAdmin = await Student.findOne({ email: "admin@smartcampus.com" });

        if (existingAdmin) {
            console.log("Default admin already exists.");
            return;
        }

        const hashedPassword = await bcrypt.hash("12345678", 10);

        await Student.create({
            email: "admin@smartcampus.com",
            password: hashedPassword,
            name: "Super Admin",
            rollNo: "ADMIN001",
            role: "SUPER_ADMIN",
            department: null,
            semester: null,
            hostelBlock: null,
        });

        console.log("Default admin created successfully!");
    } catch (err) {
        console.error("Error creating default admin:", err.message);
    }
};

const register = async (req, res) => {
    try {
        const { email, password, name, rollNo, department, semester, hostelBlock } = req.body;

        // Check if student already exists
        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
            return res.status(400).json({ message: "Student with this email already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new student
        const newStudent = new Student({
            email,
            password: hashedPassword,
            name,
            rollNo,
            department,
            semester,
            hostelBlock,
            role: 'STUDENT' // Default role
        });

        await newStudent.save();

        res.status(201).json({ message: `Student registered with email ${email}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find student by email
        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: student._id, email: student.email, role: student.role },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            student: {
                id: student._id,
                email: student.email,
                name: student.name,
                role: student.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

const refresh = async (req, res) => {
    // Placeholder for token refresh logic
    res.json({ message: "Refresh token endpoint" });
};

const logout = async (req, res) => {
    // Placeholder for logout logic (e.g., invalidate token)
    res.json({ message: "Logout endpoint" });
};

module.exports = {
    createDefaultAdmin,
    register,
    login,
    refresh,
    logout
};

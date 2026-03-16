const jwt = require('jsonwebtoken');
const User = require('../models/Student');

/**
 * ROLES:
 * - SUPER_ADMIN: Full system access (Arjun Mehta)
 * - TEACHER: Academic events only, limited groups (Prof. Smith)
 * - BUS_ADMIN: Transport events only, assigned bus (Ravi Kumar)
 * - LAUNDRY_ADMIN: Laundry events only, assigned block (Priya Nair)
 * - MESS_ADMIN: Mess events only, assigned mess (Suresh Babu)
 * - STUDENT: Read-only, notifications only (John Doe)
 */

const VALID_ROLES = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN', 'STUDENT'];

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token -- authorization denied" });
    }
    
    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: "User doesn't exist" });
        }
        
        const userRole = decoded.role || user.role;
        if (!VALID_ROLES.includes(userRole)) {
            return res.status(403).json({ message: "Invalid role" });
        }

        req.user = { 
            id: decoded.id, 
            role: userRole, 
            username: user.name,
            name: user.name,
            groups: user.groups // for RBAC checks
        };
        next();
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
};

const allowRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized - no user" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized access - insufficient permissions" });
        }
        next();
    };
};

/**
 * Check if user has any of the allowed roles OR is SUPER_ADMIN
 */
const allowRolesWithSuper = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized - no user" });
        }
        const allowedRoles = [...roles, 'SUPER_ADMIN'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized access - insufficient permissions" });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    allowRoles,
    allowRolesWithSuper,
    VALID_ROLES
};

const jwt = require('jsonwebtoken');
const User = require('../model/userModel')

// Roles we have is 1) Teacher 2)MessAdmin 3) LaundryAdmin 4) Bus driver

const verifyToken = async (req,res,next) =>{
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({message: "No token -- authorisation denied"});
    }
    
    const token = authHeader.split(" ")[1];

    try{
        const decoded = jwt.verify(token,process.env.JWT_SECRET_KEY);
        const user = await User.findById(decoded.id).select(-password);
        if(!user){
            res.sendStatus(401).json({message: "User doesn't exist child\n"});
        }
        req.user = { id: decoded.id, role: decoded.role || user.role, username: user.username };
        next();
    }catch(err){
        res.sendStatus(401).json({message: "Token is not valid"});
    }
};

const allowRoles = (...roles) =>{
    return (req,res,next) =>{
        if(!roles.includes(req.user.role)){
            return res.json(403).json({message: "Unaothorized access"});
        }
        next();
    }
}


module.exports = {
    verifyToken,
    allowRoles,
}

const EVENT_PERMISSIONS = {
    TEACHER: ["CLASS_CANCELLED","CLASS_RESCHEDULED"],
    DRIVER: ["BUS_DELAYED","BUSS_ARRIVED"],
    MESS_ADMIN: ["MESS_CHECKIN","MESS_ABSENT","MESS_REFUND_APPROVED"],
    LAUNDRY_ADMIN: ["WASH_SLOT_BOOKED","WASH_MACHINE_STARTED"]
};

const checkEventPermissions = async (req,res,next)=>{
    const {type} = req.body;
    const role = req.user.role;

    if(!EVENT_PERMISSIONS[role]?.includes(type)){
        return res.sendStatus(403).json({
            message: "Not authorised to trigger this event"
        })
    }
    next();
};

module.exports = {checkEventPermissions};
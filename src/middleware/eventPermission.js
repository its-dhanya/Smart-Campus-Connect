/**
 * EVENT PERMISSION MIDDLEWARE
 * Fine-grained check that the authenticated user's role
 * is allowed to fire the specific event type in the request body.
 *
 * Usage: router.post('/event', verifyToken, checkEventPermissions, handler)
 */

const EVENT_PERMISSIONS = {
  TEACHER:       ['CLASS_CANCELLED', 'CLASS_RESCHEDULED', 'EXAM_POSTPONED'],
  BUS_ADMIN:     ['BUS_DELAYED', 'BUS_ARRIVED', 'BUS_CANCELLED'],
  MESS_ADMIN:    ['MESS_REFUND_PROCESSED'], // only processing approved refunds
  LAUNDRY_ADMIN: [], // laundry events are fully automatic
  // SUPER_ADMIN can fire anything — handled below
};

const checkEventPermissions = (req, res, next) => {
  const { type } = req.body;
  const role = req.user?.role;

  // SUPER_ADMIN bypasses all event-type checks
  if (role === 'SUPER_ADMIN') return next();

  if (!EVENT_PERMISSIONS[role]?.includes(type)) {
    return res.status(403).json({
      message: 'Not authorised to trigger this event type',
      yourRole: role,
      allowedTypes: EVENT_PERMISSIONS[role] || [],
    });
  }

  next();
};

module.exports = { checkEventPermissions, EVENT_PERMISSIONS };
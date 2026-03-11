const schema = require('../shared/event.schema.json');

function validateEvent(req, res, next) {
    const body = req.body || {};

    for (const field of schema.requiredFields || []) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) {
            return res.status(400).json({
                error: `Missing field ${field}`
            });
        }
    }

    next();
}

module.exports = { validateEvent };

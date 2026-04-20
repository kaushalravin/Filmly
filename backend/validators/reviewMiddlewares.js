const { reviewSchema } = require('./reviewValidators');

const validateReview = (req, res, next) => {
	try {
		const { error } = reviewSchema.validate(req.body);

		if (error) {
			return res.status(400).json({
				message: error.details[0].message,
			});
		}

		next();
	} catch (err) {
		return res.status(400).json({
			message: err.message,
		});
	}
};

module.exports = { validateReview };

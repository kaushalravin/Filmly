const Joi = require("joi");

const reviewSchema = Joi.object({
	rating: Joi.number()
		.integer()
		.min(1)
		.max(10)
		.required()
		.messages({
			"number.base": "Rating must be a number",
			"number.integer": "Rating must be a whole number",
			"number.min": "Rating must be at least 1",
			"number.max": "Rating cannot be more than 10",
			"any.required": "Rating is required",
		}),

	content: Joi.string()
		.trim()
		.min(1)
		.max(2000)
		.required()
		.messages({
			"string.empty": "Review content is required",
			"string.min": "Review content is required",
			"string.max": "Review content cannot exceed 2000 characters",
			"any.required": "Review content is required",
		}),
});

module.exports = { reviewSchema };

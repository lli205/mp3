const { fail } = require('../utils/response');

// module.exports = (err, req, res, next) => {
//   if (res.headersSent) return next(err);
//   const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
//   const message = err.expose ? err.message : (err.message || 'Server error');
//   return fail(res, message, status, { error: err.name });
// };

// middleware/error.js
module.exports = (err, _req, res, _next) => {
	let status = err.status || 500;
	let message = err.message || 'Internal Server Error';
	let data = null;
  
	// Treat invalid ObjectId as Not Found per FAQ
	if (err.name === 'CastError') {
	  status = 404;
	  message = 'Not found';
	  data = null;
	}
  
	// Duplicate key & validation
	if (err.name === 'MongoServerError' && err.code === 11000) {
	  status = 400;
	  message = 'Duplicate value';
	  data = { error: 'DuplicateKey' };
	}
	
	if (err.name === 'ValidationError') {
	  status = 400;
	  message = 'Validation failed';
	  data = { fields: Object.keys(err.errors) };
	}
  
	res.status(status).json({ message, data });
  };
  
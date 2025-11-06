exports.ok = (res, data, message = 'OK', status = 200) => 
	res.status(status).json({ message, data });

exports.fail = (res, message, status = 400, data = null) =>
 	res.status(status).json({ message, data });

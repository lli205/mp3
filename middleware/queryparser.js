// where, sort, select, skip, limit, count
module.exports = (req, res, next) => {
	const q = req.query || {};
	try {
		const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
	
		const select = q.select ? parse(q.select)
						: q.filter ? parse(q.filter) : undefined;
	
		req.qp = {
			where: q.where ? parse(q.where) : {},
			sort:  q.sort  ? parse(q.sort)  : undefined,
			select,
			skip:  q.skip  ? Number(q.skip)  : undefined,
			limit: q.limit ? Number(q.limit) : undefined,
			count: q.count === 'true' || q.count === true
	  	};
	  	next();
	} catch {
	  	next({ status: 400, message: 'Invalid JSON in query params', expose: true });
	}
};
  
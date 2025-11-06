const User = require('../models/user');
const Task = require('../models/task');
const qp = require('../middleware/queryParser');
const { ok } = require('../utils/response');

// where, sort, select, skip, limit
function applyQuery(Model, q) {
	let cur = Model.find(q.where || {});
	if (q.select) cur = cur.select(q.select);
	if (q.sort) cur = cur.sort(q.sort);
	if (q.skip !== undefined) cur = cur.skip(q.skip);
	if (q.limit !== undefined) cur = cur.limit(q.limit);
	return cur;
}


module.exports = function (router) {
  // GET /api/users
  // count
	router.get('/', qp, async (req, res, next) => {
		try {
			if (req.qp.count) {
				const count = await User.countDocuments(req.qp.where || {});
				return ok(res, count);
			}
			const data = await applyQuery(User, req.qp).lean();
			return ok(res, data);
		} catch (e) { next(e); }
	});

	router.get('/:id', qp, async (req, res, next) => {
		try {
			const proj = req.qp.select || undefined;
			const doc  = await User.findById(req.params.id, proj).lean();
			if (!doc) return res.status(404).json({ message: 'User not found', data: null });
			return res.json({ message: 'OK', data: doc });
		} catch (e) { next(e); }
	});

	// POST /api/users
	router.post('/', async (req, res, next) => {
		try {
			const { name, email } = req.body;
			if (!name || !email) return res.status(400).json({ message: 'name and email are required', data: null });
			const dupe = await User.findOne({ email });
			if (dupe) return res.status(400).json({ message: 'email already exists', data: null });

			const pendingTasks = Array.isArray(req.body.pendingTasks) ? req.body.pendingTasks : [];
			const user = await User.create({ name, email, pendingTasks });

			if (pendingTasks.length) {
				await Task.updateMany(
				{ _id: { $in: pendingTasks } },
				{ assignedUser: String(user._id), assignedUserName: user.name }
				);
			}
			return ok(res, user, 'Created', 201);
		} catch (e) { next(e); }
	});

  	// PUT /api/users/:id (replace)
  	router.put('/:id', async (req, res, next) => {
		try {
			const user = await User.findById(req.params.id);
			if (!user) return res.status(404).json({ message: 'User not found', data: null });

			const { name, email } = req.body;
			if (!name || !email) return res.status(400).json({ message: 'name and email are required', data: null });

			if (email !== user.email) {
				const dupe = await User.findOne({ email });
				if (dupe) return res.status(400).json({ message: 'email already exists', data: null });
			}

			const newPending = Array.isArray(req.body.pendingTasks) ? req.body.pendingTasks.map(String) : [];
			const oldPending = user.pendingTasks.map(String);

			const removed = oldPending.filter(id => !newPending.includes(id));
			if (removed.length) {
				await Task.updateMany(
				{ _id: { $in: removed }, assignedUser: String(user._id) },
				{ assignedUser: '', assignedUserName: 'unassigned' }
				);
			}

			const added = newPending.filter(id => !oldPending.includes(id));
			if (added.length) {
				await Task.updateMany(
				{ _id: { $in: added } },
				{ assignedUser: String(user._id), assignedUserName: name }
				);
			}

			user.name = name;
			user.email = email;
			user.pendingTasks = newPending;
			await user.save();

			return ok(res, user);
		} catch (e) { next(e); }
  	});

  	// DELETE /api/users/:id
	router.delete('/:id', async (req, res, next) => {
		try {
			const user = await User.findByIdAndDelete(req.params.id);
			if (!user) return res.status(404).json({ message: 'User not found', data: null });
			if (user.pendingTasks?.length) {
				await Task.updateMany(
				{ _id: { $in: user.pendingTasks } },
				{ assignedUser: '', assignedUserName: 'unassigned' }
				);
			}
			return res.status(200).json({
				message: 'User deleted successfully',
				data: user.toObject()
			});
		} catch (e) { next(e); }
	});

  	return router;
};

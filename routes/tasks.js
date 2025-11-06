const Task = require('../models/task');
const User = require('../models/user');
const qp = require('../middleware/queryParser');
const { ok } = require('../utils/response');

function applyQuery(Model, q) {
	let cur = Model.find(q.where || {});
	if (q.select) cur = cur.select(q.select);
	if (q.sort) cur = cur.sort(q.sort);
	if (q.skip !== undefined) cur = cur.skip(q.skip);
	if (q.limit !== undefined) cur = cur.limit(q.limit);
	else cur = cur.limit(100); // spec default for tasks
	return cur;
}

async function syncUserPendingOnTask(taskDoc) {
	if (taskDoc.assignedUser) {
		const uid = taskDoc.assignedUser;
		const user = await User.findById(uid);
		if (!user) return;
		const tid = String(taskDoc._id);
		const has = user.pendingTasks.map(String).includes(tid);
		const shouldHave = !taskDoc.completed;
		if (shouldHave && !has) { user.pendingTasks.push(tid); await user.save(); }
		if (!shouldHave && has) { user.pendingTasks = user.pendingTasks.filter(id => String(id) !== tid); await user.save(); }
	}
}

module.exports = function (router) {
  	// GET /api/tasks
	router.get('/', qp, async (req, res, next) => {
		try {
			if (req.qp.count) {
				const count = await Task.countDocuments(req.qp.where || {});
				return ok(res, count);
			}
			const data = await applyQuery(Task, req.qp).lean();
			return ok(res, data);
		} catch (e) { next(e); }
	});

	router.get('/:id', qp, async (req, res, next) => {
		try {
			const proj = req.qp.select || undefined;
			const doc  = await Task.findById(req.params.id, proj).lean();
			if (!doc) return res.status(404).json({ message: 'Tast not found', data: null });
			return res.json({ message: 'OK', data: doc });
		} catch (e) { next(e); }
  	});

  	// POST /api/tasks
	router.post('/', async (req, res, next) => {
		try {
		const { name, deadline } = req.body;
		if (!name || !deadline) return res.status(400).json({ message: 'name and deadline are required', data: null });

		let assignedUser = req.body.assignedUser || '';
		let assignedUserName = req.body.assignedUserName || 'unassigned';
		if (assignedUser) {
			const u = await User.findById(assignedUser);
			if (!u) return res.status(400).json({ message: 'assignedUser not found', data: null });
			assignedUserName = u.name; // authoritative
		}

		const task = await Task.create({
			name,
			description: req.body.description ?? '',
			deadline: new Date(Number(req.body.deadline) || req.body.deadline),
			completed: String(req.body.completed).toLowerCase() === 'true',
			assignedUser,
			assignedUserName
		});

		if (assignedUser && !task.completed) {
			await User.findByIdAndUpdate(assignedUser, { $addToSet: { pendingTasks: task._id } });
		}

		return ok(res, task, 'Created', 201);
		} catch (e) { next(e); }
  	});

  	// PUT /api/tasks/:id
	router.put('/:id', async (req, res, next) => {
		try {
		const task = await Task.findById(req.params.id);
		if (!task) return res.status(404).json({ message: 'Task not found', data: null });

		const { name, deadline } = req.body;
		if (!name || !deadline) return res.status(400).json({ message: 'name and deadline are required', data: null });

		let assignedUser = req.body.assignedUser || '';
		let assignedUserName = req.body.assignedUserName || 'unassigned';
		if (assignedUser) {
			const u = await User.findById(assignedUser);
			if (!u) return res.status(400).json({ message: 'assignedUser not found', data: null });
			assignedUserName = u.name;
		}

		if (task.assignedUser && task.assignedUser !== assignedUser) {
			await User.findByIdAndUpdate(task.assignedUser, { $pull: { pendingTasks: task._id } });
		}

		task.name = name;
		task.description = req.body.description ?? '';
		task.deadline = new Date(Number(deadline) || deadline);
		task.completed = String(req.body.completed).toLowerCase() === 'true';
		task.assignedUser = assignedUser;
		task.assignedUserName = assignedUserName;
		await task.save();

		await syncUserPendingOnTask(task);
			return ok(res, task);
		} catch (e) { next(e); }
	});

  // DELETE /api/tasks/:id
  	router.delete('/:id', async (req, res, next) => {
		try {
			const task = await Task.findByIdAndDelete(req.params.id);
			if (!task) return res.status(404).json({ message: 'Task not found', data: null });
			if (task.assignedUser) {
				await User.findByIdAndUpdate(task.assignedUser, { $pull: { pendingTasks: task._id } });
			}
		
			return res.status(200).json({
				message: 'Task deleted successfully',
				data: { _id: task._id, name: task.name }
			});
		} catch (e) { next(e); }
	});

  	return router;
};

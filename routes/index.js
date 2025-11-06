const express = require('express');
/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app /*, _router not needed */) {
    app.use('/api',        require('./home.js')(express.Router()));
    app.use('/api/users',  require('./users.js')(express.Router()));
    app.use('/api/tasks',  require('./tasks.js')(express.Router()));
};

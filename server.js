var serveStatic = require('serve-static');
var app = require('connect')();
app.use(serveStatic(__dirname));
app.listen(8000);
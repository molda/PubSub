require('total.js').http('debug');

var declaration = require('fs').readFileSync('../pubsub.js').toString();

INSTALL('module', 'pubsub', declaration, {}, function(){
	console.log('done');

	PUBSUB.subscribe('hello');
	PUBSUB.on('hello', function(msg){
		console.log('hello', msg);
	});
	PUBSUB.on('message', function(topic, msg){
		console.log('message', topic, msg);
	});
});
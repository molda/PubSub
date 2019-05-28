exports.install = function() {

	F.file('/@pubsub/client.js', client_js);

	F.websocket('/@pubsub', websocket, ['authorize', 'json']);
};

function client_js(req, res) {
	res.content(200, script, 'application/javascript');
}

var TOPICS = {};
var TOPICS_SERVER = [];

global.PUBSUB = {
	subscribe: function(topic){

		if (!TOPICS_SERVER.includes(topic))
			TOPICS_SERVER.push(topic);
	},
	unsubscribe: function(topic){

		var index = TOPICS_SERVER.indexOf(topic);

		if (index > -1)
			TOPICS_SERVER.splice(1, index);
	},
	subscribe_client: function(topic, id){

		if (topic instanceof Array)
			topic.forEach(t => PUBSUB._subscribe_client(t, id));
		else
			PUBSUB._subscribe_client(topic, id);
	},
	_subscribe_client: function(topic, id){

		if (!TOPICS[topic])
			TOPICS[topic] = [];

		if (TOPICS[topic].indexOf(id) < 0)
			TOPICS[topic].push(id);
	},
	unsubscribe_client: function(topic, id){

		if (topic instanceof Array)
			topic.forEach(t => PUBSUB._unsubscribe_client(t, id));
		else
			PUBSUB._unsubscribe_client(topic, id);
	},
	_unsubscribe_client: function(topic, id){

		var arr = TOPICS[topic];

		if (!arr || ! arr.length)
			return;

		for (var i = 0, len = arr.length; i < len; i++)
			if (arr[i] === id)
				arr.splice(i, 1);
	},
	_unsubscribeClient: function(id){

		Object.keys(TOPICS).forEach(function(topic){
			var arr = TOPICS[topic];

			if (!arr || ! arr.length)
				return;

			for (var i = 0, len = arr.length; i < len; i++)
				if (arr[i] === id)
					arr.splice(i, 1);
		});		
	},
	unsubscribeAll: function(){
		TOPICS = {};
	},
	publish: function(topic, msg, clientid){
		
		if (TOPICS[topic])
			TOPICS[topic].forEach(function(cid){
				var sub = PUBSUB.ws.find(cid);
				if (sub && (!clientid || sub.id !== clientid)) // do not send to the publisher
					sub.send({
						action: 'publish',
						topic: topic,
						message: msg
					});
			});
		// if no clientid passed in then it was published by server, ignore it
		if (clientid && TOPICS_SERVER.includes(topic)) {
			PUBSUB.emit(topic, msg);
		}
	},
	$events: {

	},
	on: function(name, fn) {
		if (PUBSUB.$events[name])
			PUBSUB.$events[name].push(fn);
		else
			PUBSUB.$events[name] = [fn];
	},
	emit: function(name, a, b, c, d, e, f, g) {
		var evt = PUBSUB.$events[name];
		if (evt) {
			var clean = false;
			for (var i = 0, length = evt.length; i < length; i++) {
				if (evt[i].$once)
					clean = true;
				evt[i].call(PUBSUB, a, b, c, d, e, f, g);
			}
			if (clean) {
				evt = evt.remove(n => n.$once);
				if (evt.length)
					PUBSUB.$events[name] = evt;
				else
					PUBSUB.$events[name] = undefined;
			}
		}
	},
	once: function(name, fn) {
		fn.$once = true;
		PUBSUB.on(name, fn);
	},
	removeListener: function(name, fn) {
		var evt = PUBSUB.$events[name];
		if (evt) {
			evt = evt.remove(n => n === fn);
			if (evt.length)
				PUBSUB.$events[name] = evt;
			else
				PUBSUB.$events[name] = undefined;
		}
	},
	removeAllListeners: function(name) {
		if (name)
			self.$events[name] = undefined;
		else
			self.$events = {};
	}
};

function websocket() {
	var self = this;

	self.autodestroy(function() {

		PUBSUB.ws = null;	
		PUBSUB.unsubscribeAll();
	});

	self.on('open', function(client) {
		PUBSUB.emit('client-connected', client);
	});

	self.on('message', function(client, msg) {

		switch(msg.action) {
			case 'subscribe':
				PUBSUB.subscribe_client(msg.topic, client.id, msg);
				PUBSUB.emit('subscribe', msg.topic, client.id, msg);
				break;
			case 'unsubcribe':
				PUBSUB.unsubscribe_client(msg.topic, client.id, msg);
				PUBSUB.emit('unsubscribe', msg.topic, client.id, msg);
				break;
			case 'publish':
				PUBSUB.publish(msg.topic, msg.message, client.id);
				PUBSUB.emit('message', msg.topic, msg.message);
				break;
		}
	});

	self.on('close', function(client, msg, code) {
		PUBSUB._unsubscribeClient(client.id);
		PUBSUB.emit('client-disconnected', client);
	});

	PUBSUB.ws = self;
}

var script = `
function PubSub() {
	var self = this;
	var url = (location.protocol.length === 6 ? 'wss' : 'ws') + '://' + location.host + '/@pubsub';
	var ws;
	var queue = [];
	var sending = false;
	var subscribtions = {};
	self.online = false;

	self.connect = function() {
		ws && self.close();
		setTimeout(function() {
			ws = new WebSocket(url);
			ws.onopen = onOpen;
			ws.onclose = onClose;
			ws.onerror = onError;
			ws.onmessage = onMessage;
		}, 100);
		return self;
	};

	self.close = function(isClosed) {
		if (!ws)
			return self;
		self.online = false;
		ws.onopen = ws.onclose = ws.onmessage = null;
		!isClosed && ws.close();
		ws = null;
		self.emit('disconnected');
		subscribtions = {};
		return self;
	};

	self.subscribe = function(topic) {
		if (!subscribtions[topic]) {
			queue.push(encodeURIComponent(JSON.stringify({
				action: 'subscribe',
				topic: topic
			})));
			subscribtions[topic] = true;
			processQueue();
		}
		return self;
	};

	self.unsubscribe = function(topic) {
		if (subscribtions[topic]) {
			queue.push(encodeURIComponent(JSON.stringify({
				action: 'unsubscribe',
				topic: topic
			})));
			processQueue();
			subscribtions[topic] = false;
		}
		return self;
	};

	self.publish = function(topic, message) {
		queue.push(encodeURIComponent(JSON.stringify({
			action: 'publish',
			topic: topic,
			message: message
		})));
		processQueue();
		return self;
	};

	function processQueue(callback) {

		if (!ws || sending || !queue.length || ws.readyState !== 1) {
			callback && callback();
			return;
		}

		sending = true;

		function next(cb) {
			if (!queue.length) {
				cb && cb();
				sending = false;
				return;
			}
			var msg = queue.pop();
			ws && ws.send(msg);
			setTimeout(function(){ next(cb); }, 10);
		};
		next(callback);
	};

	function onClose() {
		self.close(true);
		setTimeout(self.connect, 2000);
	};

	function onError(err) { };

	function onMessage(e) {
		var msg;
		try {
			msg = JSON.parse(decodeURIComponent(e.data));
		} catch (e) {
			WARN('PubSub "{0}": {1}'.format(url, e.toString()));
		}

		if (msg.action === 'publish' && subscribtions[msg.topic]) {
			self.emit('message', msg.topic, msg.message);
			self.emit(msg.topic, msg.message);
		}
	};

	function onOpen() {
		self.online = true;
		processQueue(function() {
			self.emit('connected');
		});
	};

	self.$events = {};
	self.on = function(name, fn) {
		if (self.$events[name])
			self.$events[name].push(fn);
		else
			self.$events[name] = [fn];
	};

	self.emit = function(name, a, b, c, d, e, f, g) {
		var evt = self.$events[name];
		if (evt) {
			var clean = false;
			for (var i = 0, length = evt.length; i < length; i++) {
				if (evt[i].$once)
					clean = true;
				evt[i].call(self, a, b, c, d, e, f, g);
			}
			if (clean) {
				evt = evt.remove(n => n.$once);
				if (evt.length)
					self.$events[name] = evt;
				else
					self.$events[name] = undefined;
			}
		}
	};

	self.once = function(name, fn) {
		fn.$once = true;
		self.on(name, fn);
	};

	self.removeListener = function(name, fn) {
		var evt = self.$events[name];
		if (evt) {
			evt = evt.remove(n => n === fn);
			if (evt.length)
				self.$events[name] = evt;
			else
				self.$events[name] = undefined;
		}
	};

	self.removeAllListeners = function(name) {
		if (name)
			self.$events[name] = undefined;
		else
			self.$events = {};
	};

	self.connect();
	return self;
};`;
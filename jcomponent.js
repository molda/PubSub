COMPONENT('pubsub', 'reconnect:2000', function(self, config) {

	var ws, url = '@pubsub';
	var queue = [];
	var sending = false;
	var subscribtions = {};

	self.online = false;
	self.readonly();
	self.singleton();

	self.make = function() {		
		if (!url.match(/^(ws|wss)\:\/\//))
			url = (location.protocol.length === 6 ? 'wss' : 'ws') + '://' + location.host + (url.substring(0, 1) !== '/' ? '/' : '') + url;
		setTimeout(self.connect, 500);
		self.destroy = self.close;
	};

	self.publish = function(topic, message) {
		queue.push(encodeURIComponent(JSON.stringify({
			action: 'publish',
			topic: topic,
			message: message
		})));
		self.process();
		return self;
	};

	self.subscribe = function(topic) {
		if (!subscribtions[topic]) {
			queue.push(encodeURIComponent(JSON.stringify({
				action: 'subscribe',
				topic: topic
			})));
			subscribtions[topic] = true;
			self.process();
		}
		return self;
	};

	self.unsubscribe = function(topic) {
		if (subscribtions[topic]) {
			queue.push(encodeURIComponent(JSON.stringify({
				action: 'unsubscribe',
				topic: topic
			})));
			self.process();
			subscribtions[topic] = false;
		}
		return self;
	};

	self.process = function(callback) {

		if (!ws || sending || !queue.length || ws.readyState !== 1) {
			callback && callback();
			return;
		}

		sending = true;
		var async = queue.splice(0, 3);
		async.waitFor(function(item, next) {
			ws.send(item);
			setTimeout(next, 5);
		}, function() {
			callback && callback();
			sending = false;
			queue.length && self.process();
		});
	};

	self.close = function(isClosed) {
		if (!ws)
			return self;
		self.online = false;
		ws.onopen = ws.onclose = ws.onmessage = null;
		!isClosed && ws.close();
		ws = null;
		EMIT('pubsub', false, self);
		subscribtions = {};
		return self;
	};

	function onClose() {
		self.close(true);
		setTimeout(self.connect, config.reconnect);
	}

	function onMessage(e) {
		var msg;
		try {
			msg = PARSE(decodeURIComponent(e.data));
			//self.attrd('jc-path') && self.set(msg);
		} catch (e) {
			WARN('PUBSUB "{0}": {1}'.format(url, e.toString()));
		}

		if (msg.action === 'publish' && subscribtions[msg.topic])
			EMIT('pubsub-message', msg.topic, msg.message);
	}

	function onOpen() {
		self.online = true;
		self.process(function() {
			EMIT('pubsub', true, self);
		});
	}

	self.connect = function() {
		ws && self.close();
		setTimeout2(self.id, function() {
			ws = new WebSocket(url);
			ws.onopen = onOpen;
			ws.onclose = onClose;
			ws.onmessage = onMessage;
		}, 100);
		return self;
	};
});
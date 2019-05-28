# PubSub

Simple implementation of Publisher/Subscriber system as a module for Total.js framework

Client library is served at /@pubsub/client.js
It reconnects automaticaly when a connection is lost.

## Instalation
Just place the pubsub.js file in <your-app-folder>/modules/ folder.

## Usage

Server:
```javascript
	// subscribe to a single topic
	PUBSUB.subscribe('hello');

	// subscribe to a multiple topics
	PUBSUB.subscribe([ 'hello2', 'hello3' ]);

	// unsubscribe from a single topic
	PUBSUB.unsubscribe('hello');

	// unsubscribe from a multiple topics
	PUBSUB.unsubscribe([ 'hello2', 'hello3' ]);

	// listen for a message with 'hello' topic
	PUBSUB.on('hello', function(msg){
		console.log('hello', msg);
	});

	// listen for all the message subscribed to
	PUBSUB.on('message', function(topic, msg){
		console.log('message', topic, msg);
	});

	// publish a message with 'hello' topic
	PUBSUB.publish('hello', 'world');
```



Client:
```javascript
	<script src="/@pubsub/client.js"></script>
	<script>
		var pubsub = new PubSub();

		// event emited once the websocket successfuly connects to the server
		pubsub.on('connected', function(){
			console.log('connected');

			// subscribe to a single topic
			pubsub.subscribe('hello');

			// subscribe to a multiple topics
			pubsub.subscribe([ 'hello2', 'hello3' ]);

			// unsubscribe from a single topic
			pubsub.unsubscribe('hello');

			// unsubscribe from a multiple topics
			pubsub.unsubscribe([ 'hello2', 'hello3' ]);
		});

		// event emited when the websocket disconnects from the server
		pubsub.on('disconnected', function(){
			console.log('disconnected');
		});

		// listen for a message with 'hello' topic
		pubsub.on('hello', function(msg){
			console.log('hello', msg);
		});

		// listen for all the message subscribed to
		pubsub.on('message', function(topic, msg){
			console.log('message', topic, msg);
		});
	</script>
```
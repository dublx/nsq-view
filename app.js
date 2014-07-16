var util = require('util');
var nsqChannel, nsq, nsqOptions;
nsq = require('nsqjs');
nsqChannel = 'nsq-view';
nsqOptions = {
  lookupdHTTPAddresses: (process.env.NSQ_VIEW_LOOKUPDHTTP || '127.0.0.1:4161')
};

// declare globals
nsqReaders = [];
nsqTopics = [];

//********
// updates nsqlookupd nsqTopics every second
var request = require('request');
var _ = require('underscore');
var getTopics = function() {
  var requestOptions ={
    url:'http://' + nsqOptions.lookupdHTTPAddresses + '/topics',
    timeout: 5 * 1000
  }
  request(requestOptions, function(error, response, body) {

    if (!error && response.statusCode == 200) {
      var resp = JSON.parse(body);

      //if all topics are new
      if (nsqTopics.length == 0 && resp.data.topics.length > 0) {
        console.log('registering all nsqTopics...');
        _.each(resp.data.topics, function(topic) {
          console.log('topic: ' + topic);
          nsqTopics.push(topic);
          io.emit('app:msg', 'found topic: ' + topic);
          io.emit('topic:list', nsqTopics);
        })
      } else {
        var newTopics = _.difference(resp.data.topics, nsqTopics);
        if (newTopics.length > 0) console.log('registering new nsqTopics...');
        _.each(newTopics, function(topic) {
          console.log('new topic: ' + topic);
          io.emit('app:msg', 'found topic: ' + topic);
          io.emit('topic:list', nsqTopics);
          nsqTopics.push(topic)
        })
      }
      // announce nsqTopics to all socket.io connections
    } else {
      console.log('Request %s %s', requestOptions.url, error);
      io.emit('app:msg', util.format('Request %s %s', requestOptions.url, error));
    }
  });
}
var getTopicsInt = setInterval(getTopics, 2000);
///********



var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);


app.get('/', function(req, res) {
  res.sendfile('index.html');
});

io.on('connection', function(socket) {
  console.log('socket.client.id: %s connected', socket.client.id)
  console.log('Sending topic:list [%s] to %s', nsqTopics, socket.client.id);
  io.emit('topic:list', nsqTopics);

  socket.on('topic:unsubscribe', function(topic) {
    console.log('Socket %s unsubscribed to rooms %s"', socket.client.id, topic);
    socket.leave(topic);
    var readerIndex;
    var nsqReaderForTopic = _.find(nsqReaders, function(reader, index) {
      readerIndex = index;
      return reader.topic == topic;
    });
    console.log('readerIndex', readerIndex);
    if (nsqReaderForTopic) {
      nsqReaderForTopic.sockets--;
      console.log('NSQ reader for topic %s sockets(-): %s', nsqReaderForTopic.topic, nsqReaderForTopic.sockets);
      if (nsqReaderForTopic.sockets == 0) {
        console.log('Destroying NSQ reader for topic %s', nsqReaderForTopic.topic);
        nsqReaderForTopic.close();
        nsqReaders.splice(readerIndex,1);
        // nsqReaders[nsqReaderForTopic] = null;
        nsqReaderForTopic = null;
      }
    }
  });

  socket.on('topic:subscribe', function(topic) {

    console.log('Socket %s is subscribed to rooms %s, requesting subscribe to "%s"', socket.client.id, socket.rooms, topic);
    var topicSubscribed = false;
    _.each(socket.rooms, function(room) {
      if (!topicSubscribed) {
        if (topic == room) {
          topicSubscribed = true;
        }
      }
    });

    console.log('topicSubscribed %s', topicSubscribed);

    if (!topicSubscribed) {
      console.log('socket %s is joining room "%s"', socket.client.id, topic);
      socket.join(topic);

      // check if we already have a NSQ reader for this topic, if so, dont create another one.
      // console.log('nsqReaders', nsqReaders);
      var nsqReaderForTopic = _.find(nsqReaders, function(reader) {
        if (reader.topic == topic) reader.socket++;
        return reader.topic == topic;
      });

      console.log('nsqReader For Topic %s %s', topic, (nsqReaderForTopic !== undefined ? 'exists':'does not exist'));

      if (!nsqReaderForTopic) {
        console.log('Creating NSQ reader for topic "%s"', topic);
        // make a new nsq nsqReader for the topic
        nsqReader = new nsq.Reader(topic, nsqChannel, nsqOptions);
        nsqReader.topic = topic;
        nsqReader.sockets = 1;
        nsqReader.connect();
        nsqReader.on(nsq.Reader.MESSAGE, function(msg) {
          console.log('Send NSQ msg to socket room %s', nsqReader.topic);
          io.to(nsqReader.topic).emit(nsqReader.topic, msg.body.toString());
          // console.log("%s: message [%s]: %s", nsqReader.topic, msg.id, msg.body.toString());
          return msg.finish();
        });
        nsqReader.on(nsq.Reader.DISCARD, function(msg) {
          console.log("%s: Discard message [%s]: %s", nsqReader.topic, msg.id, msg.body.toString());
        });
        nsqReader.on(nsq.Reader.ERROR, function(err) {
          console.log("%s: nsqReader err: " + err);
        });
        nsqReader.on(nsq.Reader.NSQD_CONNECTED, function() {
          console.log('Nsq connected %s:%s topic="%s"', arguments[0], arguments[1], nsqReader.topic);
          io.emit('info', 'Subscribed to topic "%s"', nsqReader.topic);
        });
        nsqReader.on(nsq.Reader.NSQD_CLOSED, function() {
          console.log('%s: Nsq closed %s:%s', nsqReader.topic, arguments[0], arguments[1]);
        });
        nsqReaders.push(nsqReader);
      } else {
        nsqReaderForTopic.sockets++;
        console.log('NSQ reader for topic %s sockets(+): %s', nsqReaderForTopic.topic, nsqReaderForTopic.sockets);
      }
    } else {
      console.log('Socket already subscribed to room/topic "%s"', topic);
    }
  });
  socket.on('disconnect', function() {
    console.log('socket.on:disconnect');
  });
});


var port = (process.env.NSQ_VIEW_PORT || 3000);
http.listen(port, function() {
  console.log('listening on *:%s', port);
});

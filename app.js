var nsqChannel, nsq, nsqOptions, nsqReaders, topic, nsqTopics;
nsq = require('nsqjs');
topic = 'sample';
nsqChannel = 'nodejs';

nsqOptions = {
  lookupdHTTPAddresses: '127.0.0.1:4161'
};
nsqReaders = [];
nsqTopics = [];
//********
// updates nsqlookupd nsqTopics every second
var request = require('request');
var _ = require('underscore');
var getTopics = function(){
  request('http://' + nsqOptions.lookupdHTTPAddresses + '/topics', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var resp = JSON.parse(body);

      //if all topics are new
      if(nsqTopics.length==0 && resp.data.topics.length>0)
      {
        console.log('registering all nsqTopics...');
        _.each(resp.data.topics, function (topic) {
          console.log('topic: ' + topic);
          nsqTopics.push(topic);
          // announce a topic
          io.emit('topic:new', topic);
        })
      }
      else //if there are new, unknown topics
      {
        var newTopics = _.difference(resp.data.topics, nsqTopics);
        if (newTopics.length>0) console.log('registering new nsqTopics...');
        _.each(newTopics, function (topic) {
          console.log('topic: ' + topic);
          nsqTopics.push(topic)
          // announce a topic
          io.emit('topic:new', topic);
        })

      }
    }
  });
}
var getTopicsInt = setInterval(getTopics, 5000);
///********



var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);


app.get('/', function(req, res){
  res.sendfile('index.html');
});


io.on('connection', function(socket){
  // console.dir(socket)
  console.log('socket.client.id: %s connected',socket.client.id)
  console.log('user connected');
  // io.emit('chat message', 'existing nsqTopics: ' + nsqTopics);
  // if (!socket.topics){
  //   socket.topics = [];
    _.each(nsqTopics, function (item) {
      // announce a topic
      io.emit('topic:new', item);
    })
  // }
  socket.on('topic:subscribe', function(topic){
    var found = _.find(nsqReaders, function (reader) {
      return reader.topic == topic;
    })
    if (!found)
    {
      console.log('Subscribing to topic "%s"', topic);
      // make a new nsq nsqReader for the topic
      var nsqReader = new nsq.Reader(topic, nsqChannel, nsqOptions);
      nsqReader.topic = topic;
      nsqReader.connect();
      nsqReader.on(nsq.Reader.MESSAGE, function(msg) {
        io.emit(nsqReader.topic, msg.body.toString());
        console.log("%s: message [%s]: %s", nsqReader.topic, msg.id, msg.body.toString());
        return msg.finish();
      });
      nsqReader.on(nsq.Reader.DISCARD, function (msg){
        console.log("%s: Discard message [%s]: %s", nsqReader.topic, msg.id, msg.body.toString());
      });
      nsqReader.on(nsq.Reader.ERROR, function (err){
        console.log("%s: nsqReader err: " + err);
      });
      nsqReader.on(nsq.Reader.NSQD_CONNECTED, function (){
        console.log('Nsq connected %s:%s topic="%s"', arguments[0], arguments[1], nsqReader.topic);
        io.emit('info', 'Subscribed to topic "%s"', nsqReader.topic);
      });
      nsqReader.on(nsq.Reader.NSQD_CLOSED, function (){
        console.log('%s: Nsq closed %s:%s', nsqReader.topic, arguments[0], arguments[1]);
      });
      nsqReaders.push[nsqReader];
    }

    // }
    // else
    // {
    //   io.emit('info', 'Already subscribed to topic');
    // }
  });
});


var port = 3009;
http.listen(port, function(){
  console.log('listening on *:%s', port);
});

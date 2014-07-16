nsq-view
========

View realtime NSQ messages in any topic from the comfort of your browser.


# About
NSQ view is a realtime message viewer for NSQ. 

The Server application continuosly pools for NSQ topics and announces new topics to web clients. Web clients can then subscribe/unsubscribe to any topic. 

When the web client subsacribes to a topic, a new channel is created in NSQ and messages are streamed to the web client using websockets. Only one channel per topic is created independent of how many web clients are subscribed to that topic, so your ```nsqd```'s are only getting an aditional connection.

# Requirements
* Nodejs (v0.10.29+)
* Nsq (v0.2.28+)

# Install
```shell
git clone git@github.com:dublx/nsq-view.git
cd nsq-view/
npm install
```

# Running
```shell
# start NSQLookup and NSQ
nsqlookupd &> nsqlookupd.log &
nsqd --lookupd-tcp-address=127.0.0.1:4160 &> nsqd.log &
```
then start the node.js web server using default NSQLookupd address (127.0.0.1:4161) and web server ports (3000)
```shell
node app.js
```
or change the defaults using environment variables
```shell
NSQ_VIEW_LOOKUPDHTTP=my-lookupd-host:4161 NSQ_VIEW_PORT=5678 node app.js
```

# Example posting to NSQ
```
curl -d "it really tied the room together2" http://localhost:4151/pub\?topic\=sample
```
Then open http://localhost:3000 , select the sample topic and subscribe to it.

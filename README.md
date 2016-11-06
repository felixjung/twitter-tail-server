# Twitter Tail Server

This is a single-file node server that allows clients to connect to Twitter's
streaming API. Tweets from Twitter are returned to clients through a socket.io
connection.

The server is designed to handle multiple clients. Clients are added to rooms
matching their filtering criteria, so that multiple clients can be served with a
single connection to the Twitter API.

const IoServer = require('socket.io');
const Twitter = require('twit');
const yargs = require('yargs');
const log = require('winston');
const _ = require('lodash');
const config = require('./config');
log.remove(log.transports.Console);
log.add(log.transports.Console, { colorize: true });

const { port = 8080, env = 'production' } = yargs
  .alias('p', 'port')
  .argv;

log.level = env === 'develop' ? 'debug' : 'info';

const twitter = new Twitter(config);

const io = new IoServer(port);

log.info(`Server listening on port ${port}.`);

io.on('connection', handleConnection);

const streams = {};

function handleConnection(socket) {
  log.debug(`User conntected on socket ${socket.id}.`);
  socket.on('subscribe', tag => handleSubscription(socket, tag));
  socket.on('unsubscribe', tag => handleUnsubscription(socket, tag));
  socket.on('disconnect', (socket) => {
    log.debug(`User on socket ${socket.id} disconnected.`);
    closeUnusedStreams();
  });
}

function handleSubscription(socket, tag) {
  log.debug('Handling subscription.');
  socket.join(tag, () => {
    log.debug(`Socket ${socket.id} subscribed to stream ${tag}.`);
  });

  twitter.get(
    'search/tweets',
    { q: tag, count: 10 },
    (err, { statuses }) => {
      if (err) {
        log.error('An error occured: ', err);
        return;
      }

      const value = { filter: tag, tweets: statuses };
      socket.emit('tweet', value);
  });

  const streamExists = _.has(streams, tag);

  if (!streamExists) {
    const stream = twitter.stream('statuses/filter', { track: tag });
    streams[tag] = stream;
    stream.on('tweet', tweet => {
      const value = { filter: tag, tweets: [tweet] };
      log.debug('Value', value);
      io.to(tag).emit('tweet', value);
    });
  }
}

function handleUnsubscription(socket, tag) {
  socket.leave(tag);
  closeUnusedStreams();
}

function closeUnusedStreams() {
  log.debug('Trying to close unused streams.')
  const rooms = _.get(io, 'sockets.adapter.rooms');
  if (_.isUndefined(rooms)) { log.debug('rooms is undefined.'); }

  _.forEach(rooms, (members, room) => {
    log.debug(`Checking room ${room}`);
    log.debug(`Room ${room} has members ${members}`)
    if (!members.length) { return; }
    const tagStream = _.get(streams, room);

    if (tagStream) {
      log.info('Stopping and removing stream ${room} ')
      tagStream.stop();
      streams = _.omit(streams, tag);
    }
  });
}

'use strict';
 
const net = require('net');
const ReadWriteLock = require('rwlock');

const PORT = 23;
const HOST = '127.0.0.1';
 
class TelnetAvr {
 constructor(host, port) {
  this.host = host || HOST;
  this.port = port || PORT;
  this.lock = new ReadWriteLock();
 }
 
 sendMessage(message) {
  var me = this;
  return new Promise((resolve, reject) => {
   me.lock.writeLock(function (release) {
    var socket = net.Socket();
    socket.setTimeout(2000, () => socket.destroy());
    socket.once('connect', () => socket.setTimeout(0));
    socket.connect(me.port, me.host, () => {
     socket.write(message+'\r');
     require('deasync').sleep(100);
     socket.write(message+'\r');
     if (!message.startsWith('?')) {
      resolve(message + ':SENT');
      socket.end();
     }
    });

    socket.on('close', () => {
     require('deasync').sleep(100);
     release();
    });
 
    socket.on('data', (d) => {
     let data = d
      .toString()
      .replace('\n', '')
      .replace('\r', '');
     resolve(data);
     socket.end();
    });
 
    socket.on('error', (err) => {
     reject(err);
    });
   });
  });
 }
}
module.exports = TelnetAvr;

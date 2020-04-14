const net = require('net');
var fs = require('fs');
const format = require("node.date-time");
const cluster = require('cluster');
const os = require('os');

const server = net.createServer();

function logTime() {
  return new Date().format("[" + "Y-MM-dd HH:mm:SS" + "]" + " ");
}

// Returns true if the process is a master. This is determined by the process.env.NODE_UNIQUE_ID. If process.env.NODE_UNIQUE_ID is undefined, then isMaster is true.
if (cluster.isMaster) {
    // os.cpus() method returns an array of objects containing information about each CPU/core installed.
    const workers = 8;
    console.log('Master cluster setting up ' + workers + ' workers...');
    // spawns new worker processes, it can only be called from the master process.
    for (var i = 0; i < workers; i++) {
        cluster.fork();
    }
    // cluster event listeners
    cluster.on('online', (worker) => {
        console.log('Worker ' + worker.process.pid + ' is online');
    })
    cluster.on('exit', (worker, code, signal) => {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        console.log('Starter a new worker');
        cluster.fork();
    })
} else {
  server.on('connection', (clientToProxySocket) => {
    console.log('Client Connected To Proxy');
    // We need only the data once, the starting packet
    clientToProxySocket.once('data', (data) => {
      console.log(data.toString());

      let isTLSConnection = data.toString().indexOf('CONNECT') !== -1;

      // By Default port is 80
      let serverPort = 80;
      let serverAddress;
      if (isTLSConnection) {
        // Port changed if connection is TLS
        serverPort = data.toString()
                            .split('CONNECT ')[1].split(' ')[0].split(':')[1];;
        serverAddress = data.toString()
                            .split('CONNECT ')[1].split(' ')[0].split(':')[0];
        serverRequestType = data.toString()
                            .split(' ', 1);
      } else {
        serverAddress = data.toString().split('Host: ')[1].split('\r\n')[0];
      }

      console.log(serverAddress);

      let proxyToServerSocket = net.createConnection({
        host: serverAddress,
        port: serverPort
      }, () => {
        console.log('PROXY TO SERVER SET UP');
        //Wruting in log.file
        fs.appendFile('log-file.log', logTime() + '<' + clientToProxySocket.remoteAddress +'>' + ' ' +
         '<' + serverRequestType + '>' + ' ' + '<' + serverAddress + '>' + '' + '\n', "utf-8", function(err) {
         if (err) throw err;
        });
        if (isTLSConnection) {
          clientToProxySocket.write('HTTP/1.1 200 OK\r\n\n');
        } else {
          proxyToServerSocket.write(data);
        }

        clientToProxySocket.pipe(proxyToServerSocket);
        proxyToServerSocket.pipe(clientToProxySocket);

        proxyToServerSocket.on('error', (err) => {
          console.log('PROXY TO SERVER ERROR');
          console.log(err);
        });

      });
      clientToProxySocket.on('error', err => {
        console.log('CLIENT TO PROXY ERROR');
        console.log(err);
      });
    });
  });

  server.on('error', (err) => {
    console.log('SERVER ERROR');
    console.log(err);
    throw err;
  });

  server.on('close', () => {
    console.log('Client Disconnected');
  });

  server.listen(8124, () => {
    console.log('Server runnig at http://localhost:' + 8124);
  });
}

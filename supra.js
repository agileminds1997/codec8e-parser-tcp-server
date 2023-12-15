const express = require('express');
const net = require('net');

const { crc16Arc,
    imeiChecker,
    codec8eChecker,
    codec8EParser,
    codecParserTrigger,
    asciiImeiConverter,
    jsonPrinter,
    jsonPrinterRawData,
    timeStamper,
    timeStamperForJson,
    deviceTimeStamper,
    recordDelayCounter,
    parseDataInteger,
    intMultiply01,
    intMultiply001,
    intMultiply0001,
    signedNoMultiply,
    parseFunctionsDictionary,
    sortingHat,
    fileAccessTest } = require('./tL');

const app = express();
const port = 42354;
const server = net.createServer((socket) => {
    console.log('Client connected');

    // Send back a handshake binary response "01"
    const response = Buffer.from([0x01]);
    socket.write(response);

    // Handle incoming data from the client (if needed)
    socket.on('data', (data) => {
        // Handle data from the client
        console.log('Received data:', data.toString('hex'));
        console.log(`// ${timeStamper()} // data received = ${data.toString('hex')}`);

            if (!data.length) {
                // Connection closed by the client
                console.log(`// ${timeStamper()} // Connection closed by ${socket.remoteAddress}`);
                socket.end();
                return;
            }

            if (imeiChecker(data.toString('hex')) !== false) {
                deviceImei = asciiImeiConverter(data.toString('hex'));
                const imeiReply = Buffer.from([1]);
                socket.write(imeiReply);
                console.log(`-- ${timeStamper()} sending reply = ${imeiReply.toString('hex')}`);
            } else if (codec8eChecker(data.toString('hex').replace(/ /g, '')) !== false) {
                const recordNumber = codecParserTrigger(data.toString('hex'), deviceImei, 'SERVER');
                console.log(`received records ${recordNumber}`);
                console.log(`from device IMEI = ${deviceImei}`);
                console.log();

                const recordResponse = Buffer.alloc(4);
                recordResponse.writeUInt32BE(recordNumber);
                socket.write(recordResponse);
                console.log(`// ${timeStamper()} // response sent = ${recordResponse.toString('hex')}`);
            } else {
                console.log(`// ${timeStamper()} // no expected DATA received - dropping connection`);
                socket.end();
            }
        });

    // Handle client disconnection
    socket.on('end', () => {
        console.log('Client disconnected');
    });
});

// Listen on port 42354
const PORT = 42354;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

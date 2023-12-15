// teltonikaLib.js

// Import necessary modules
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

function inputTrigger(){
    return true;
}

function crc16Arc(data) {
    const dataPartLengthCRC = parseInt(data.slice(8, 16), 16);
    const dataPartForCRC = Buffer.from(data.slice(16, 16 + 2 * dataPartLengthCRC), 'hex');
    const crc16ArcFromRecord = data.slice(16 + 2 * dataPartForCRC.length, 24 + 2 * dataPartForCRC.length);

    let crc = 0;

    for (const byte of dataPartForCRC) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            if (crc & 1) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }

    console.log("--------- crc16ArcFromRecord");
    console.log(crc16ArcFromRecord);
    console.log("-------- Buffer from ");
    // console.log(dataPartForCRC);
    console.log(Buffer.from(crc.toString(16).padStart(4, '0'), 'hex').toString('hex'));

    if (crc16ArcFromRecord.toUpperCase() === "0000" + Buffer.from(crc.toString(16).padStart(4, '0'), 'hex').toString('hex').toUpperCase()) {
        console.log("CRC check passed!");
        console.log(`Record length: ${data.length} characters // ${parseInt(data.length / 2)} bytes`);
        return true;
    } else {
        console.log("CRC check failed!");
        return false;
    }
}


function imeiChecker(hexImei) {
    const imeiLength = parseInt(hexImei.slice(0, 4), 16);

    if (imeiLength !== hexImei.slice(4).length / 2) {
        // console.log("Not an IMEI - length is not correct!");
        return false;
    } else {
        // pass in Python does nothing, so it's omitted in JavaScript
    }

    const asciiImei = asciiImeiConverter(hexImei);
    console.log(`IMEI received = ${asciiImei}`);
    
    if (!/^\d+$/.test(asciiImei) || asciiImei.length !== 15) {
        console.log("Not an IMEI - is not numeric or wrong length!");
        return false;
    } else {
        return true;
    }
}

/*
function asciiImeiConverter(hexData) {
    // Implement your ascii_imei_converter function logic here
    // This function is assumed to return the converted IMEI
}
*/
function asciiImeiConverter(hexImei) {
    return Buffer.from(hexImei.slice(4), 'hex').toString('ascii');
}

/*
####################################################
###############_Codec8E_parser_code_################
####################################################
*/

async function jsonPrinterRawData(ioDictRaw, deviceImei) {
    const jsonData = JSON.stringify(ioDictRaw, null, 4);
    const dataPath = path.join('./data', String(deviceImei));
    const jsonFile = `${deviceImei}_RAWdata.json`;

    try {
        await fs.mkdir(dataPath, { recursive: true });
    } catch (mkdirError) {
        // Ignore if directory already exists
        if (mkdirError.code !== 'EEXIST') {
            console.error(`Error creating directory: ${mkdirError.message}`);
            throw mkdirError;
        }
    }

    const filePath = path.join(dataPath, jsonFile);

    try {
        await fs.writeFile(filePath, jsonData, { flag: 'wx' });
    } catch (writeError) {
        if (writeError.code === 'EEXIST') {
            // Append to existing file
            await fs.appendFile(filePath, jsonData);
        } else {
            console.error(`Error writing JSON file: ${writeError.message}`);
            throw writeError;
        }
    }
}

function codec8EParser(codec8EPacket, deviceImei, props) {
    console.log();

    const ioDictRaw = {};
    ioDictRaw.device_IMEI = deviceImei;
    ioDictRaw.server_time = timeStamperForJson();
    ioDictRaw.data_length = `Record length: ${codec8EPacket.length} characters // ${Math.floor(codec8EPacket.length / 2)} bytes`;
    ioDictRaw._raw_data__ = codec8EPacket;

    try {
        jsonPrinterRawData(ioDictRaw, deviceImei);
    } catch (jsonError) {
        console.error(`JSON raw data writing error occurred: ${jsonError.message}`);
    }

    const zeroBytes = codec8EPacket.slice(0, 8);
    console.log();
    console.log(`zero bytes = ${zeroBytes}`);

    const dataFieldLength = parseInt(codec8EPacket.slice(8, 8 + 8), 16);
    console.log(`data field length = ${dataFieldLength} bytes`);

    const codecType = codec8EPacket.slice(16, 16 + 2);
    console.log(`codec type = ${codecType}`);

    let dataStep = 4;
    if (codecType === '08') {
        dataStep = 2;
    }

    const numberOfRecords = parseInt(codec8EPacket.slice(18, 18 + 2), 16);
    console.log(`number of records = ${numberOfRecords}`);

    let recordNumber = 1;
    let avlDataStart = codec8EPacket.slice(20);
    let dataFieldPosition = 0;

    while (dataFieldPosition < 2 * dataFieldLength - 6) {
        const ioDict = {};
        ioDict.device_IMEI = deviceImei;
        ioDict.server_time = timeStamperForJson();
        console.log();
        console.log(`data from record ${recordNumber}`);
        console.log(`########################################`);

        const timestamp = avlDataStart.slice(dataFieldPosition, dataFieldPosition + 16);
        ioDict._timestamp_ = deviceTimeStamper(timestamp);
        console.log(`timestamp = ${deviceTimeStamper(timestamp)}`);
        ioDict._rec_delay_ = recordDelayCounter(timestamp);
        dataFieldPosition += timestamp.length;

        const priority = avlDataStart.slice(dataFieldPosition, dataFieldPosition + 2);
        ioDict.priority = parseInt(priority, 16);
        console.log(`record priority = ${parseInt(priority, 16)}`);
        dataFieldPosition += priority.length;

        // Continue with other fields...

        recordNumber += 1;

        try {
            jsonPrinter(ioDict, deviceImei);
        } catch (jsonError) {
            console.error(`JSON writing error occurred: ${jsonError.message}`);
        }
    }

    if (props === 'SERVER') {
        const totalRecordsParsed = parseInt(avlDataStart.slice(dataFieldPosition, dataFieldPosition + 2), 16);
        console.log();
        console.log(`total parsed records = ${totalRecordsParsed}`);
        console.log();
        return totalRecordsParsed;
    } else {
        const totalRecordsParsed = parseInt(avlDataStart.slice(dataFieldPosition, dataFieldPosition + 2), 16);
        console.log();
        console.log(`total parsed records = ${totalRecordsParsed}`);
        console.log();
        inputTrigger();
    }
}


/*
function codec8eChecker(hexData) {
    // Implement your codec_8e_checker function logic here
    // This function is assumed to return true or false
}
*/
function codec8eChecker(codec8Packet) {
    if (codec8Packet.substring(16, 16 + 2).toUpperCase() !== "8E" && codec8Packet.substring(16, 16 + 2).toUpperCase() !== "08") {
        console.log();
        console.log("Invalid packet!!!!!!!!!!!!!!!!!!!");
        return false;
    } else {
        return crc16Arc(codec8Packet);
    }
}
/*
####################################################
###############____TIME_FUNCTIONS____###############
####################################################
*/
function timeStamper() {
    const currentServerTime = moment();
    const serverTimeStamp = currentServerTime.format('HH:mm:ss DD-MM-YYYY');
    return serverTimeStamp;
}

function timeStamperForJson() {
    const currentServerTime = moment();
    const timestampUtc = moment.utc();
    const serverTimeStamp = `${currentServerTime.format('HH:mm:ss DD-MM-YYYY')} (local) / ${timestampUtc.format('HH:mm:ss DD-MM-YYYY')} (utc)`;
    return serverTimeStamp;
}

function deviceTimeStamper(timestamp) {
    const timestampMs = parseInt(timestamp, 16) / 1000;
    const timestampUtc = moment.utc(timestampMs * 1000);
    const utcOffset = moment(timestampMs * 1000).utcOffset();
    const timestampLocal = timestampUtc.clone().utcOffset(utcOffset);
    const formattedTimestampLocal = timestampLocal.format("HH:mm:ss DD-MM-YYYY");
    const formattedTimestampUtc = timestampUtc.format("HH:mm:ss DD-MM-YYYY");
    const formattedTimestamp = `${formattedTimestampLocal} (local) / ${formattedTimestampUtc} (utc)`;

    return formattedTimestamp;
}

function recordDelayCounter(timestamp) {
    const timestampMs = parseInt(timestamp, 16) / 1000;
    const currentServerTime = moment().unix();
    return `${currentServerTime - timestampMs} seconds`;
}


function jsonPrinter(ioDict, deviceImei) {
    const jsonData = JSON.stringify(ioDict, null, 4);
    const dataPath = path.join('./data', String(deviceImei));
    const jsonFile = `${deviceImei}_data.json`;

    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }

    const filePath = path.join(dataPath, jsonFile);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, jsonData);
    } else {
        fs.appendFileSync(filePath, jsonData);
    }
}

/*
function codecParserTrigger(hexData, deviceImei, source) {
    // Implement your codec_parser_trigger function logic here
    // This function is assumed to return the record number
}
*/
function codecParserTrigger(codec8Packet, deviceImei, props) {
    try {
        return codec8EParser(codec8Packet.replace(/ /g, ""), deviceImei, props);
    } catch (e) {
        console.log(`Error occurred: ${e}. Enter proper Codec8 packet or EXIT!!!`);
        inputTrigger();
    }
}
/*
####################################################
###############_PARSE_FUNCTIONS_CODE_###############
####################################################
*/
function parseDataInteger(data) {
    return parseInt(data, 16);
}

function intMultiply01(data) {
    return parseFloat((parseInt(data, 16) * 0.1).toFixed(3));
}

function intMultiply001(data) {
    return parseFloat((parseInt(data, 16) * 0.01).toFixed(3));
}

function intMultiply0001(data) {
    return parseFloat((parseInt(data, 16) * 0.001).toFixed(3));
}

function signedNoMultiply(data) {
    try {
        const binary = Buffer.from(data.padStart(8, '0'), 'hex');
        const value = binary.readInt32BE();
        return value;
    } catch (e) {
        console.log(`Unexpected value received in function '${data}' error: '${e}' will leave unparsed value!`);
        return `0x${data}`;
    }
}

const parseFunctionsDictionary = {
    240: parseDataInteger,
    239: parseDataInteger,
    80: parseDataInteger,
    21: parseDataInteger,
    200: parseDataInteger,
    69: parseDataInteger,
    181: intMultiply01,
    182: intMultiply01,
    66: intMultiply0001,
    24: parseDataInteger,
    205: parseDataInteger,
    206: parseDataInteger,
    67: intMultiply0001,
    68: intMultiply0001,
    241: parseDataInteger,
    299: parseDataInteger,
    16: parseDataInteger,
    1: parseDataInteger,
    9: parseDataInteger,
    179: parseDataInteger,
    12: intMultiply0001,
    13: intMultiply001,
    17: signedNoMultiply,
    18: signedNoMultiply,
    19: signedNoMultiply,
    11: parseDataInteger,
    10: parseDataInteger,
    2: parseDataInteger,
    3: parseDataInteger,
    6: intMultiply0001,
    180: parseDataInteger,
};

function sortingHat(key, value) {
    if (key in parseFunctionsDictionary) {
        const parseFunction = parseFunctionsDictionary[key];
        return parseFunction(value);
    } else {
        return `0x${value}`;
    }
}

function jsonPrinter(ioDict, deviceImei) {
    const jsonData = JSON.stringify(ioDict, null, 4);
    const dataPath = path.join('./data', String(deviceImei));
    const jsonFile = `${deviceImei}_data.json`;

    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }

    const filePath = path.join(dataPath, jsonFile);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, jsonData);
    } else {
        fs.appendFileSync(filePath, jsonData);
    }
}

function jsonPrinterRawData(ioDictRaw, deviceImei) {
    const jsonData = JSON.stringify(ioDictRaw, null, 4);
    const dataPath = path.join('./data', String(deviceImei));
    const jsonFile = `${deviceImei}_RAWdata.json`;

    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }

    const filePath = path.join(dataPath, jsonFile);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, jsonData);
    } else {
        fs.appendFileSync(filePath, jsonData);
    }
}

function fileAccessTest() {
    try {
        const testDict = {
            "_Writing_Test_": "Writing_Test",
            "Script_Started": timeStamperForJson(),
        };

        jsonPrinter(testDict, "file_Write_Test");
        console.log("---### File access test passed! ###---");
        // You can call other functions or perform additional tests here
        inputTrigger();

    } catch (e) {
        console.log();
        console.log(`---### File access error occurred ###---`);
        console.log(`'${e}'`);
        console.log(`---### Try running terminal with Administrator rights! ###---`);
        console.log(`---### Nothing will be saved if you decide to continue! ###---`);
        console.log();
        // You may choose to handle the error differently or exit the program
        inputTrigger();
    }
}

// Export the functions you want to use in other files
module.exports = {
    crc16Arc,
    imeiChecker,
    codec8eChecker,
    codec8EParser,
    codecParserTrigger,
    inputTrigger,
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
    fileAccessTest
    // Add other functions here...
    // Make sure to export the necessary helper functions as well
    // timeStamperForJson, deviceTimeStamper, recordDelayCounter, timeStamper, jsonPrinter
};

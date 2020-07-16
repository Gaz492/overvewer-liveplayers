const WebSocket = require('ws');
const rconClient = require('rcon-client');

const config = {
    WEBSOCKET_PORT: 8888,
    RCON_HOST: 'dev-1.ftbdev.com',
    RCON_PORT: 25566,
    RCON_PASSWORD: 'ilikebuttplugs',
    RCON_TIMEOUT: 5000,
    frequency: 1000,
    debug: false
};

var rcon,
    webSocketServer,
    interval,
    connections = [],
    lastData = {};

async function initializeRcon(config) {
    console.info(`Initializing RCON connection to ${config.RCON_HOST}:${config.RCON_PORT}`);

    rconConnected = false;
    rcon = await new rconClient.Rcon({
        host: config.RCON_HOST,
        port: config.RCON_PORT,
        password: config.RCON_PASSWORD
    });

    rcon.on("connect", () => {
        console.log("Rcon connected");
        rconConnected = true;
    })
    rcon.on("authenticated", () => console.log("Rcon authenticated"))
    rcon.on("end", () => {
        console.log("Rcon end");
        rconConnected = false;
    })

    rcon.connect();
};

initializeWebSocketServer = (config) => {
    console.info(`Starting WebSocket Server on port ${config.WEBSOCKET_PORT}`);
    try {
        webSocketServer = new WebSocket.Server({
            port: config.WEBSOCKET_PORT
        });
        webSocketServer.on('connection', openWebSocketConnection);
    } catch (error) {
        console.error(`Failed to initialize WebSocket Server`, error);
    }
};

openWebSocketConnection = (ws) => {
    console.info(`WebSocket connection opened`);
    connections.push(ws);
    ws.onclose = () => { closeWebSocketConnection(ws); };
    ws.send(JSON.stringify(lastData));
};

closeWebSocketConnection = (ws) => {
    let index = connections.indexOf(ws);
    connections.splice(index, 1);
    console.info(`WebSocket connection closed at index ${index}`);
};

sendPlayerData = (data) => {
    if (config.debug) {
        console.info(`Sending player data to ${connections.length} connections`, data);
    }
    lastData = data;
    connections.forEach((ws) => {
        ws.send(JSON.stringify(data));
    });
};

getPlayerData = () => {
    if (!rcon || !rconConnected) {
        initializeRcon(config);
    }
    if (rcon && rconConnected && connections.length) {
        getPlayers()
            .then(getAllPlayerCoords)
            .then(unpackPlayerData)
            .then(sendPlayerData);
    }
};

unpackPlayerData = (dataArray) => {
    let data = {};
    dataArray.forEach((element) => {
        data[element.name] = {
            name: element.name,
            dimension: element.dim,
            x: element.x,
            y: element.y,
            z: element.z
        };
    });
    return data;
};

getPlayers = () => {
    return rcon.send('list').then(parsePlayers);
};

parsePlayers = (listResults) => {
    let total = Number((/\d+/).exec(listResults)[0]);
    let list = [];

    if (total) {
        list = listResults.split(':')[1].split(',').map((name) => { return name.trim() });
    }

    return list;
};

getAllPlayerCoords = (playerList) => {
    return Promise.all(playerList.map(getPlayerCoords));
};

getPlayerCoords = async(playerName) => {
    let playerDim = await getPlayerDimension(playerName);
    return rcon.send(`data get entity ${playerName} Pos`).then(parsePlayerCoords).then(data => { return { name: playerName, dim: playerDim, x: data.x, y: data.y, z: data.z } });
};

getPlayerDimension = (playerName) => {
    return rcon.send(`data get entity ${playerName} Dimension`).then(parsePlayerDimension).then(data => { return data});
};

parsePlayerCoords = (playerResult) => {
    let data = playerResult.split(':')[1].replace(/[d \[ \]]/g, '').split(',');

    return {
        x: Number(data[0]),
        y: Number(data[1]),
        z: Number(data[2])
    };
};

parsePlayerDimension= (playerResult) => {
    // let data = playerResult.split(':')[1].replace(/[d \[ \]]/g, '').split(',');
    // let data = playerResult.split(':')[0];
    let data = playerResult.substr(playerResult.indexOf(':')+1).split('"')[1];

    return data;
};


initializeWebSocketServer(config);
initializeRcon(config).catch(console.error);

interval = setInterval(getPlayerData, config.frequency);
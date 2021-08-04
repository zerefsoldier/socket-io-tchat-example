const http = require("http");
const fs = require("fs");
const socketsIo = require("socket.io");
const socketsHandler = require("./handlers/sockets");

const httpServer = http.createServer((req, res) => {
    if (req.url === "/" || req.url.endsWith(".js")) {
        const path = req.url === "/" ? "views/index.html" : req.url.substring(1);
        const index = fs.readFileSync(path, {encoding: "UTF-8"});
        res.end(index);
    } else {
        res.statusCode = 404;
        res.end(`URL ${req.url} Not Found`);
    }
});

const wsServer = socketsIo(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTION"],
    }
});
socketsHandler(wsServer);

httpServer.listen(9090);
console.log("Server listen on port 9090");

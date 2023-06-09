import Game from "./game.js";
import Hyperswarm from "hyperswarm";
import goodbye from "graceful-goodbye";
import crypto from "hypercore-crypto";
import b4a from "b4a";
import JSOG from "jsog";

function generatePlayerId() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const idLength = 8;
  let playerId = "";

  for (let i = 0; i < idLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomChar = characters.charAt(randomIndex);
    playerId += randomChar;
  }

  return playerId;
}

class Play extends Game {
  constructor(spaces) {
    super();
    super.newGame();
    this._conns = [];
    this._namemap = new Map();

    // Initialize hyperswarm instance
    this.swarm = new Hyperswarm();
    goodbye(() => this.swarm.destroy());

    // Join a common space
    this.space = spaces ? b4a.from(spaces, "hex") : crypto.randomBytes(32);
    this.discovery = this.swarm.join(this.space, {
      client: true,
      server: true,
    });

    this.swarm.on("connection", this.handleConnection.bind(this));

    this.dataCallback = null;
  }

  setDataCallback(callback) {
    this.dataCallback = callback;
  }

  handleConnection(conn) {
    const name = b4a.toString(conn.remotePublicKey, "hex");
    this._namemap.set(name, generatePlayerId());
    console.log("* got a connection from:", this._namemap.get(name), "*");
    this._conns.push(conn);

    conn.on("error", (error) => {
      console.error(
        `Error on connection with ${this._namemap.get(name)}:`,
        error
      );
      this.removeConnection(conn);
    });

    conn.once("close", () => this.removeConnection(conn));
    conn.on("data", this.handleData.bind(this));
  }

  removeConnection(conn) {
    const index = this._conns.indexOf(conn);
    if (index > -1) {
      this._conns.splice(index, 1);
      console.log(
        "Connection removed. Remaining connections:",
        this._conns.length
      );
    }
  }

  handleData(data) {
    // Parse the received data
    const expr = JSOG.parse(data.toString());
    this.expressions.add(expr);

    // Send the data to all games
    console.log("expr:", expr);
    this.sendToGames(expr);

    if (this.dataCallback) {
      this.dataCallback(expr);
    }
  }

  broadcast(data) {
    // Stringify the data preserving any circular references
    const dataString = JSOG.stringify(data);
    console.log("Broadcast: ", dataString);
    // Send the data string to every connection
    this._conns.forEach((conn) => {
      conn.write(dataString);
    });
  }

  sendToGames(data) {
    for (let game of this.games) {
      game.send(data);
    }
  }
}
/*
let play = new Play(
  "3c4387f8e27a94cf1891d7510d197168fd239190aeb67932e828830526d61fe5"
);

console.log(play);
*/
export default Play;

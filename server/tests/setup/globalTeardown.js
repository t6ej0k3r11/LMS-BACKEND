const mongoose = require("mongoose");

module.exports = async () => {
  // Close all socket connections first
  if (global.__SOCKETIO__) {
    const io = global.__SOCKETIO__;
    // Get all connected sockets and disconnect them
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    // Close the Socket.io server
    io.close();
  }

  // Close the HTTP server
  if (global.__HTTPSERVER__) {
    await new Promise((resolve) => {
      global.__HTTPSERVER__.close(() => {
        resolve();
      });
    });
  }

  // Drop the test database
  await mongoose.connection.dropDatabase();

  // Close database connection
  await mongoose.connection.close();

  // Stop the in-memory MongoDB server
  if (global.__MONGOSERVER__) {
    await global.__MONGOSERVER__.stop();
  }

  // Clean up global variables
  delete global.__MONGOSERVER__;
  delete global.__MONGOCONNECTED__;
  delete global.__HTTPSERVER__;
  delete global.__SOCKETIO__;
  delete global.__TESTPORT__;
};

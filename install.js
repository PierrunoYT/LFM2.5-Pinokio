module.exports = {
  run: [{
    method: "shell.run",
    params: {
      path: "app",
      message: "npm ci --no-audit --no-fund",
    }
  }]
}

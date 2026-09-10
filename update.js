module.exports = {
  run: [{
    method: "shell.run",
    params: {
      path: ".",
      message: "git pull --ff-only",
    }
  }, {
    method: "shell.run",
    params: {
      path: "app",
      message: "npm ci --no-audit --no-fund",
    }
  }, {
    method: "notify",
    params: {
      html: "Update complete."
    }
  }]
}

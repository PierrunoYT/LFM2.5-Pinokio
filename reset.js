module.exports = {
  run: [
    {
      method: "fs.rm",
      params: {
        path: "app/node_modules"
      }
    },
    {
      method: "notify",
      params: {
        html: "Server dependencies removed. Run Install before starting again. Browser model caches and source files are unchanged."
      }
    }
  ]
}
